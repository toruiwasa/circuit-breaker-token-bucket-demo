export const ADMIT_SCRIPT = `local circuit_key = KEYS[1]
local bucket_key  = KEYS[2]
local now              = tonumber(ARGV[1])
local cooldown_ms       = tonumber(ARGV[2])
local probe_lock_ttl_ms = tonumber(ARGV[3])
local capacity          = tonumber(ARGV[4])
local refill_rate       = tonumber(ARGV[5])
local estimated         = tonumber(ARGV[6])
local reservation_id    = ARGV[7]
local reservation_ttl   = ARGV[8]
local state          = redis.call('HGET', circuit_key, 'state') or 'CLOSED'
local opened_at       = tonumber(redis.call('HGET', circuit_key, 'opened_at')) or 0
local probe_in_flight = redis.call('HGET', circuit_key, 'probe_in_flight') or '0'
local probe_claimed_at = tonumber(redis.call('HGET', circuit_key, 'probe_claimed_at')) or 0
local is_probe = false
if state == 'OPEN' then
  if (now - opened_at) < cooldown_ms then
    return {0, 'BREAKER_OPEN', 0}
  end
  if probe_in_flight == '1' and (now - probe_claimed_at) < probe_lock_ttl_ms then
    return {0, 'PROBE_IN_PROGRESS', 0}
  end
  redis.call('HSET', circuit_key, 'state', 'HALF_OPEN', 'probe_in_flight', '1', 'probe_claimed_at', now)
  is_probe = true
elseif state == 'HALF_OPEN' then
  if probe_in_flight == '1' and (now - probe_claimed_at) < probe_lock_ttl_ms then
    return {0, 'HALF_OPEN_WAIT', 0}
  end
  redis.call('HSET', circuit_key, 'probe_in_flight', '1', 'probe_claimed_at', now)
  is_probe = true
end
local tokens = tonumber(redis.call('HGET', bucket_key, 'tokens')) or capacity
local last   = tonumber(redis.call('HGET', bucket_key, 'last_refill')) or now
local elapsed = now - last
tokens = math.min(capacity, tokens + elapsed * refill_rate)
if tokens < estimated then
  redis.call('HSET', bucket_key, 'tokens', tokens, 'last_refill', now)
  if is_probe then
    redis.call('HSET', circuit_key, 'state', 'OPEN', 'probe_in_flight', '0')
  end
  return {0, 'INSUFFICIENT_TOKENS', 0}
end
tokens = tokens - estimated
redis.call('HSET', bucket_key, 'tokens', tokens, 'last_refill', now)
redis.call('SET', 'reservation:' .. reservation_id,
  estimated .. ':' .. (is_probe and '1' or '0'),
  'PX', reservation_ttl)
return {1, reservation_id, is_probe and 1 or 0}`;

export const REPORT_SCRIPT = `local circuit_key = KEYS[1]
local bucket_key  = KEYS[2]
local reservation_id   = ARGV[1]
local success           = ARGV[2] == '1'
local actual_tokens     = tonumber(ARGV[3]) or 0
local is_rate_limit_err = ARGV[4] == '1'
local failure_threshold = tonumber(ARGV[5])
local now               = tonumber(ARGV[6])
local capacity          = tonumber(ARGV[7])
local reservation_key = 'reservation:' .. reservation_id
local raw = redis.call('GET', reservation_key)
if not raw then
  return {0, 'RESERVATION_EXPIRED'}
end
local sep = string.find(raw, ':')
local estimated = tonumber(string.sub(raw, 1, sep - 1))
local is_probe = string.sub(raw, sep + 1) == '1'
redis.call('DEL', reservation_key)
if success then
  local delta = estimated - actual_tokens
  local tokens = tonumber(redis.call('HGET', bucket_key, 'tokens')) or capacity
  tokens = math.min(capacity, tokens + delta)
  redis.call('HSET', bucket_key, 'tokens', tokens)
  redis.call('HSET', circuit_key, 'state', 'CLOSED', 'failure_count', 0, 'probe_in_flight', '0')
  return {1, 'OK'}
end
if is_rate_limit_err then
  redis.call('HSET', bucket_key, 'tokens', 0)
end
if is_probe then
  redis.call('HSET', circuit_key, 'state', 'OPEN', 'opened_at', now, 'probe_in_flight', '0')
else
  local failure_count = redis.call('HINCRBY', circuit_key, 'failure_count', 1)
  if failure_count >= failure_threshold then
    redis.call('HSET', circuit_key, 'state', 'OPEN', 'opened_at', now)
  end
end
return {1, 'RECORDED'}`;
