package config

import (
	"flag"
	"fmt"
	"os"
	"reflect"
	"strconv"
)

// Helper interno per verificare che l'input sia un puntatore a struct
func getStructInfo[T any](ptr *T) (reflect.Value, reflect.Type, error) {
	if ptr == nil {
		return reflect.Value{}, nil, fmt.Errorf("config: il puntatore passato non può essere nil")
	}
	v := reflect.ValueOf(ptr).Elem()
	if v.Kind() != reflect.Struct {
		return reflect.Value{}, nil, fmt.Errorf("config: atteso puntatore a struct, ricevuto %T", ptr)
	}
	return v, v.Type(), nil
}

// Helper interno per convertire la stringa e scriverla nel tipo corretto
func setField(field reflect.Value, val string) {
	switch field.Kind() {
	case reflect.String:
		field.SetString(val)
	case reflect.Int:
		if i, err := strconv.Atoi(val); err == nil {
			field.SetInt(int64(i))
		}
	case reflect.Float64:
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			field.SetFloat(f)
		}
	}
}

// LoadDefaults popola la struct usando solo i valori del tag `default`
func LoadDefaults[T any](ptr *T) error {
	elem, t, err := getStructInfo(ptr)
	if err != nil {
		return err
	}
	for i := 0; i < t.NumField(); i++ {
		if def := t.Field(i).Tag.Get("default"); def != "" {
			setField(elem.Field(i), def)
		}
	}
	return nil
}

// LoadEnv popola la struct leggendo le variabili d'ambiente tramite il tag `env`
func LoadEnv[T any](ptr *T) error {
	elem, t, err := getStructInfo(ptr)
	if err != nil {
		return err
	}
	for i := 0; i < t.NumField(); i++ {
		if envKey := t.Field(i).Tag.Get("env"); envKey != "" {
			if val, ok := os.LookupEnv(envKey); ok && val != "" {
				setField(elem.Field(i), val)
			}
		}
	}
	return nil
}

// LoadFlags configura un FlagSet isolato basato sul tag `flag` ed applica 
// SOLO i flag che l'utente ha digitato esplicitamente a riga di comando.
func LoadFlags[T any](ptr *T) error {
	elem, t, err := getStructInfo(ptr)
	if err != nil {
		return err
	}

	fs := flag.NewFlagSet(os.Args[0], flag.ExitOnError)
	flagMapping := make(map[string]reflect.Value)

	// Registriamo dinamicamente i flag nel FlagSet isolato
	for i := 0; i < t.NumField(); i++ {
		if flagKey := t.Field(i).Tag.Get("flag"); flagKey != "" {
			fs.String(flagKey, "", "") // Usiamo stringe temporanee per il parsing grezzo
			flagMapping[flagKey] = elem.Field(i)
		}
	}

	if err := fs.Parse(os.Args[1:]); err != nil {
		return err
	}

	// Visit applica la closure SOLO sui flag effettivamente passati dall'utente
	fs.Visit(func(fl *flag.Flag) {
		if field, ok := flagMapping[fl.Name]; ok {
			setField(field, fl.Value.String())
		}
	})

	return nil
}
