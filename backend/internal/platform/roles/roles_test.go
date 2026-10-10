package roles

import (
	"reflect"
	"testing"
)

func TestExpand(t *testing.T) {
	got := Expand([]string{"PRESALES_MANAGER", "SOFTWARE_DEVELOPER", "MANAGER"})
	want := []string{"PRESALES_MANAGER", "SOFTWARE_DEVELOPER", "MANAGER", "PRE_SALES", "SUPER_ADMIN"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Expand = %v, want %v", got, want)
	}
	if got := Expand([]string{"BID_EXECUTIVE", "FINANCE_EXECUTIVE"}); !reflect.DeepEqual(got, []string{"BID_EXECUTIVE", "FINANCE_EXECUTIVE", "FINANCE"}) {
		t.Fatalf("BE+FE expanded to %v", got)
	}
	if got := Expand(nil); len(got) != 0 {
		t.Fatalf("Expand(nil) = %v", got)
	}
}

func TestHolders(t *testing.T) {
	got := Holders("MANAGER")
	want := []string{"MANAGER", "BID_MANAGER", "PRESALES_MANAGER", "REPORTING_MANAGER"} // no DELIVERY_MANAGER: view-only
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Holders(MANAGER) = %v, want %v", got, want)
	}
	if got := Holders("ADMIN", "SUPER_ADMIN"); !reflect.DeepEqual(got, []string{"ADMIN", "SUPER_ADMIN", "MANAGING_DIRECTOR", "SOFTWARE_DEVELOPER"}) {
		t.Fatalf("Holders(ADMIN, SUPER_ADMIN) = %v", got)
	}
}
