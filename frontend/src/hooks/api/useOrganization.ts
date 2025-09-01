import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { 
  organizationIdAtom, 
  userOrganizationAtom, 
  organizationDetailsAtom 
} from '@/atoms/organization';

export const useOrganization = () => {
  const [orgId, setOrgId] = useAtom(organizationIdAtom);
  const userOrg = useAtomValue(userOrganizationAtom);
  const orgDetails = useAtomValue(organizationDetailsAtom);
  
  // Sync user org if not set
  useEffect(() => {
    if (!orgId && userOrg) {
      setOrgId(userOrg);
    }
  }, [userOrg, orgId, setOrgId]);
  
  return {
    currentOrgId: orgId,
    setCurrentOrgId: setOrgId,
    organization: orgDetails.data,
    isLoading: orgDetails.isLoading,
    error: orgDetails.error,
  };
};