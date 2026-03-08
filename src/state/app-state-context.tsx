import type { Dispatch, PropsWithChildren } from "react";
import { createContext, useMemo, useReducer } from "react";

type DashboardState = {
  selectedAccountId: string | null;
  currency: "USD" | "NGN";
};

type DashboardAction =
  | { type: "setAccount"; payload: string | null }
  | { type: "setCurrency"; payload: DashboardState["currency"] };

type AppStateContextValue = {
  state: DashboardState;
  dispatch: Dispatch<DashboardAction>;
};

const initialState: DashboardState = {
  selectedAccountId: null,
  currency: "USD",
};

export const AppStateContext = createContext<AppStateContextValue | undefined>(
  undefined,
);

function appStateReducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case "setAccount":
      return { ...state, selectedAccountId: action.payload };
    case "setCurrency":
      return { ...state, currency: action.payload };
    default:
      return state;
  }
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(appStateReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
