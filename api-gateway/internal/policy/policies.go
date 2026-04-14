package policy

type AccessMode int

const (
	Public AccessMode = iota
	AuthOnly
	AuthWithRoles
)

type Policy struct {
	Mode          AccessMode
	RequiredRoles map[string]struct{}
}
