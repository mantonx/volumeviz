import { useAtom, useAtomValue } from 'jotai';
import {
  organizationIdAtom,
  organizationDetailsAtom,
} from '@/atoms/organization';

export const useOrganization = () => {
  const [orgId, setOrgId] = useAtom(organizationIdAtom);
  const orgDetails = useAtomValue(organizationDetailsAtom);

  return {
    currentOrgId: orgId,
    setCurrentOrgId: setOrgId,
    organization: orgDetails.data,
    isLoading: orgDetails.isLoading,
    error: orgDetails.error,
  };
};
