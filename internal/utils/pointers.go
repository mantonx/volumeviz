package utils

// Ptr returns a pointer to the given value
func Ptr[T any](v T) *T {
	return &v
}

// SafeSet safely sets a pointer field with a value
func SafeSet[T any](target **T, value T) {
	if target == nil {
		return
	}
	*target = &value
}

// SafeGet safely gets a value from a pointer, returning zero value if nil
func SafeGet[T any](ptr *T) T {
	var zero T
	if ptr == nil {
		return zero
	}
	return *ptr
}

// SafeSetIf conditionally sets a pointer field if condition is true
func SafeSetIf[T any](target **T, value T, condition bool) {
	if condition && target != nil {
		*target = &value
	}
}

// SafeSetNonZero sets a pointer field only if the value is non-zero
func SafeSetNonZero[T comparable](target **T, value T) {
	var zero T
	if target != nil && value != zero {
		*target = &value
	}
}

// Example usage:
// Instead of: SetInt32Field(&metadata.Width, 1920)
// Use:        SafeSet(&metadata.Width, int32(1920))
//
// Instead of: SetStringField(&metadata.Title, "Movie")
// Use:        SafeSet(&metadata.Title, "Movie")
//
// Instead of: width := GetInt32Value(metadata.Width)
// Use:        width := SafeGet(metadata.Width)
//
// Instead of: metadata.Height = Int32Ptr(1080)
// Use:        metadata.Height = Ptr(int32(1080))
