package physics

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/t3labit/cri40-scenario-tools/internal/config"
)

// TagInfo memorizza i metadati estratti dal tag di un singolo campo
type TagInfo struct {
	Kind string // "property", "input", "output"
	Name string // es: "ambient_temperature"
	Unit string // es: "°C"
}

// parseTag scompone la stringa `physics:"kind,name,unit"`
func parseTag(field reflect.StructField) (*TagInfo, bool) {
	tag := field.Tag.Get("physics")
	if tag == "" {
		return nil, false
	}
	parts := strings.Split(tag, ",")
	if len(parts) != 3 {
		return nil, false
	}
	return &TagInfo{Kind: parts[0], Name: parts[1], Unit: parts[2]}, true
}

// AutoConfigure analizza il componente tramite reflection a startup:
// 1. Popola i float64 contrassegnati come 'property' con i dati del JSON
// 2. Istanzia automaticamente i *MultiInput contrassegnati come 'input' con la capacità corretta
func AutoConfigure(comp any, props map[string]config.Property, capacities map[string]int) error {
	v := reflect.ValueOf(comp).Elem()
	t := v.Type()

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		tag, ok := parseTag(field)
		if !ok {
			continue
		}

		fieldVal := v.Field(i)

		switch tag.Kind {
		case "property":
			p, exists := props[tag.Name]
			if !exists {
				return fmt.Errorf("proprietà obbligatoria '%s' mancante nella configurazione", tag.Name)
			}
			if fieldVal.Kind() == reflect.Float64 {
				fieldVal.SetFloat(p.GetNormalizedValue())
			}

		case "input":
			// Se il campo è un MultiInput, lo istanziamo noi con la dimensione perfetta calcolata dall'Engine
			if fieldVal.Type() == reflect.TypeFor[*MultiInput]() {
				caps := capacities[tag.Name]
				if caps == 0 {
					caps = 1 // Slot di sicurezza
				}
				fieldVal.Set(reflect.ValueOf(NewMultiInput(caps)))
			}
			
		case "output":
			// Se l'output è un DoubleBuffer, inizializziamo Current e Next con il valore iniziale
			// se è presente una proprietà con lo stesso nome nel JSON (es: initial_temperature)
			if fieldVal.Type() == reflect.TypeFor[DoubleBuffer]() {
				initProp, exists := props["initial_"+tag.Name]
				if exists {
					val := initProp.GetNormalizedValue()
					fieldVal.FieldByName("Current").SetFloat(val)
					fieldVal.FieldByName("Next").SetFloat(val)
				}
			}
		}
	}
	return nil
}

// BuildPortMetadata genera al volo le mappe Inputs() o Outputs() richieste dall'Engine
func BuildPortMetadata(comp any, targetKind string) map[string]config.InternalUnit {
	ports := make(map[string]config.InternalUnit)
	t := reflect.TypeOf(comp).Elem()

	for field := range t.Fields() {
		tag, ok := parseTag(field)
		if ok && tag.Kind == targetKind {
			unitEnum, _ := config.ParseUnit(tag.Unit)
			ports[tag.Name] = unitEnum
		}
	}
	return ports
}

// AutoBindInput estrae l'indirizzo di memoria di una porta di input cercandola via tag
func AutoBindInput(comp any, portName string) (*float64, error) {
	v := reflect.ValueOf(comp).Elem()
	t := v.Type()

	for i := 0; i < t.NumField(); i++ {
		tag, ok := parseTag(t.Field(i))
		if ok && tag.Kind == "input" && tag.Name == portName {
			fieldVal := v.Field(i)
			
			// Se è un MultiInput, chiamiamo il suo metodo BindNextSlot per avere la cella contigua
			if fieldVal.Type() == reflect.TypeFor[*MultiInput]() {
				mi := fieldVal.Interface().(*MultiInput)
				return mi.BindNextSlot()
			}
			
			// Se è un float64 standard (porta 1-a-1) restituiamo il suo indirizzo diretto
			if fieldVal.Kind() == reflect.Float64 {
				return fieldVal.Addr().Interface().(*float64), nil
			}
		}
	}
	return nil, fmt.Errorf("porta di input '%s' non trovata via tag reflection", portName)
}

// AutoBindOutput estrae l'indirizzo di memoria della variabile .Current di una porta di output
func AutoBindOutput(comp any, portName string) (*float64, error) {
	v := reflect.ValueOf(comp).Elem()
	t := v.Type()

	for i := 0; i < t.NumField(); i++ {
		tag, ok := parseTag(t.Field(i))
		if ok && tag.Kind == "output" && tag.Name == portName {
			fieldVal := v.Field(i)
			
			// Se è un DoubleBuffer, l'Engine deve puntare tassativamente a .Current
			if fieldVal.Type() == reflect.TypeFor[DoubleBuffer]() {
				currentField := fieldVal.FieldByName("Current")
				return currentField.Addr().Interface().(*float64), nil
			}
		}
	}
	return nil, fmt.Errorf("porta di output '%s' non trovata via tag reflection", portName)
}

// CaptureRuntimeFields analizza un componente via reflection ed estrae i valori 
// istantanei di TUTTI gli ingressi e di TUTTE le uscite censiti nei tag.
func CaptureRuntimeFields(comp any) (map[string]float64, map[string]float64) {
	inputs := make(map[string]float64)
	outputs := make(map[string]float64)

	v := reflect.ValueOf(comp).Elem()
	t := v.Type()

	for i := 0; i < t.NumField(); i++ {
		tag, ok := parseTag(t.Field(i))
		if !ok {
			continue
		}

		fieldVal := v.Field(i)
		switch tag.Kind {
		case "input":
			if fieldVal.Type() == reflect.TypeFor[*MultiInput]() {
				if !fieldVal.IsNil() {
					mi := fieldVal.Interface().(*MultiInput)
					inputs[tag.Name] = mi.Sum()
				}
			} else if fieldVal.Kind() == reflect.Float64 {
				inputs[tag.Name] = fieldVal.Float()
			}
		case "output":
			if fieldVal.Type() == reflect.TypeFor[DoubleBuffer]() {
				outputs[tag.Name] = fieldVal.FieldByName("Current").Float()
			}
		}
	}
	return inputs, outputs
}
