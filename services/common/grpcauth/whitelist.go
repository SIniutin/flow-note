package grpcauth

// Whitelist builds a set of public/full method names.
func Whitelist(methods ...string) map[string]struct{} {
	if len(methods) == 0 {
		return map[string]struct{}{}
	}
	m := make(map[string]struct{}, len(methods))
	for _, method := range methods {
		if method == "" {
			continue
		}
		m[method] = struct{}{}
	}
	return m
}

func IsWhitelisted(whitelist map[string]struct{}, method string) bool {
	if len(whitelist) == 0 || method == "" {
		return false
	}
	_, ok := whitelist[method]
	return ok
}
