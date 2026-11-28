package core

type User struct {
	ID          string   `json:"id"`
	Username    string   `json:"username"`
	DisplayName string   `json:"displayName"`
	Roles       []string `json:"roles"`
}

func (u *User) HasRole(role string) bool {
	if u == nil {
		return false
	}
	for _, assigned := range u.Roles {
		if assigned == role {
			return true
		}
	}
	return false
}
