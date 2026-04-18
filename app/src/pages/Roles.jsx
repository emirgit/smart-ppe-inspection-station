import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Shield } from 'lucide-react';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [ppeItems, setPpeItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getRoles(), api.getPpeItems()]).then(([r, p]) => {
      setRoles(r);
      setPpeItems(p);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Roles & PPE</h1>
        <p className="text-sm text-gray-500 mt-1">Configure required PPE equipment for each job role</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map(role => (
          <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{role.roleName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Required PPE</p>
              <div className="flex flex-wrap gap-1.5">
                {role.requiredPpe.map(key => {
                  const item = ppeItems.find(p => p.itemKey === key);
                  return (
                    <span key={key} className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-md border border-primary-100">
                      {item?.displayName || key}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
