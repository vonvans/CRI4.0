package interceptor

import "fmt"

type Factory func() any

var registry = map[string]Factory{}

// Funzione da chiamare nei file dei plugin per registrarsi
func Register(name string, factory Factory) {
	registry[name] = factory
}

func Get(name string) (any, error) {
	if factory, exists := registry[name]; exists {
		return factory(), nil
	}
	return nil, fmt.Errorf("plugin %s not found", name)
}
