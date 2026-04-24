import { createContext, useContext } from 'react';

const defaultValue = {
  bumpSession: () => {},
  sessionNonce: 0,
};

export const DashboardSessionContext = createContext(defaultValue);

export function useDashboardSession() {
  return useContext(DashboardSessionContext);
}
