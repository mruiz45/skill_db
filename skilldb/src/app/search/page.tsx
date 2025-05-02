'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { User, Skill, UserSkill, Certification } from '@/types';

type SkillWithCertifications = {
  skill: Skill;
  level: number;
  hasCertification: boolean;
  certifications?: Certification[];
  // Legacy fields for backwards compatibility
  certificationName?: string;
  certificationExpiry?: string;
};

type SearchResult = {
  user: User;
  skills: SkillWithCertifications[];
};

export default function SearchPage() {
  const { user, loading, isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [skillFilter, setSkillFilter] = useState<string>('');
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [minLevel, setMinLevel] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Charger les compétences disponibles
  React.useEffect(() => {
    const fetchSkills = async () => {
      try {
        const { data, error } = await supabase
          .from('skills')
          .select('*')
          .order('name');
        
        if (error) throw error;
        setAvailableSkills(data as Skill[]);
      } catch (err: any) {
        console.error('Error fetching skills:', err);
        setError('Une erreur est survenue lors du chargement des compétences');
      }
    };
    
    fetchSkills();
  }, []);
  
  const handleSearch = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    setResults([]);
    
    try {
      // Construire la requête de base pour récupérer les utilisateurs
      let query = supabase
        .from('users')
        .select('*');
      
      // Filtrer par nom si un terme de recherche est saisi
      if (searchTerm) {
        query = query.ilike('fullName', `%${searchTerm}%`);
      }
      
      const { data: userData, error: userError } = await query;
      
      if (userError) throw userError;
      
      if (!userData || userData.length === 0) {
        setIsLoading(false);
        return; // Aucun utilisateur trouvé
      }
      
      // Récupérer les compétences pour chaque utilisateur
      const resultPromises = userData.map(async (user: User) => {
        let skillQuery = supabase
          .from('user_skills')
          .select('*, skill:skills(*)')
          .eq('userId', user.id);
        
        // Filtrer par compétence spécifique si sélectionnée
        if (skillFilter) {
          skillQuery = skillQuery.eq('skillId', skillFilter);
        }
        
        // Filtrer par niveau minimum
        if (minLevel > 1) {
          skillQuery = skillQuery.gte('level', minLevel);
        }
        
        // Filtrer pour ne montrer que les compétences certifiées
        if (certifiedOnly) {
          skillQuery = skillQuery.eq('hasCertification', true);
        }
        
        const { data: userSkillsData, error: skillsError } = await skillQuery;
        
        if (skillsError) throw skillsError;
        
        // Si aucune compétence ne correspond aux critères, ne pas inclure cet utilisateur
        if (!userSkillsData || userSkillsData.length === 0) {
          return null;
        }
        
        // Récupérer les certifications pour chaque compétence d'utilisateur
        const userSkillsWithCertifications = await Promise.all(
          userSkillsData.map(async (us: UserSkill) => {
            const { data: certificationsData, error: certError } = await supabase
              .from('certifications')
              .select('*')
              .eq('userskill_id', us.id);
              
            if (certError) {
              console.error('Error fetching certifications:', certError);
              return {
                skill: us.skill as Skill,
                level: us.level,
                hasCertification: us.hasCertification,
                certificationName: us.certificationName,
                certificationExpiry: us.certificationExpiry,
              };
            }
            
            // Map database field names to our type
            const certifications = (certificationsData || []).map(cert => ({
              id: cert.id,
              userskillId: cert.userskill_id,
              name: cert.name,
              date: cert.date,
              expiryDate: cert.expiry_date,
              createdAt: cert.created_at,
              updatedAt: cert.updated_at
            }));
            
            return {
              skill: us.skill as Skill,
              level: us.level,
              hasCertification: us.hasCertification || certifications.length > 0,
              certifications: certifications.length > 0 ? certifications : undefined,
              certificationName: us.certificationName,
              certificationExpiry: us.certificationExpiry,
            };
          })
        );
        
        // Formater les résultats
        return {
          user,
          skills: userSkillsWithCertifications,
        };
      });
      
      const results = (await Promise.all(resultPromises)).filter(Boolean) as SearchResult[];
      setResults(results);
    } catch (err: any) {
      console.error('Error searching users:', err);
      setError('Une erreur est survenue lors de la recherche');
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetFilters = () => {
    setSearchTerm('');
    setSkillFilter('');
    setCertifiedOnly(false);
    setMinLevel(1);
    setResults([]);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Vous devez être connecté pour accéder à cette page</h2>
        <p className="mt-2 text-gray-600">Veuillez vous connecter pour rechercher des compétences</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Recherche de profils</h1>
      
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      
      <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
        <div className="px-4 py-5 sm:px-6 bg-gray-50">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Critères de recherche
          </h3>
        </div>
        
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <Input 
                label="Nom de la personne" 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom..."
              />
            </div>
            
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700">
                Compétence
              </label>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Toutes les compétences</option>
                {availableSkills.map(skill => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name} ({skill.type === 'hard' ? 'Technique' : 'Soft'})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Niveau minimum
              </label>
              <select
                value={minLevel}
                onChange={(e) => setMinLevel(Number(e.target.value))}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value={1}>1 - Débutant ou plus</option>
                <option value={2}>2 - Intermédiaire ou plus</option>
                <option value={3}>3 - Avancé ou plus</option>
                <option value={4}>4 - Expert ou plus</option>
                <option value={5}>5 - Maître uniquement</option>
              </select>
            </div>
            
            <div className="sm:col-span-2 flex items-center">
              <input
                id="certifiedOnly"
                type="checkbox"
                checked={certifiedOnly}
                onChange={(e) => setCertifiedOnly(e.target.checked)}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="certifiedOnly" className="ml-2 block text-sm text-gray-700">
                Uniquement les compétences certifiées
              </label>
            </div>
            
            <div className="sm:col-span-2 flex items-end space-x-3">
              <Button 
                onClick={handleSearch}
                isLoading={isLoading}
              >
                Rechercher
              </Button>
              <Button 
                type="button" 
                variant="secondary"
                onClick={resetFilters}
              >
                Réinitialiser
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
          <p className="text-gray-600">Recherche en cours...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Résultats ({results.length} {results.length === 1 ? 'personne trouvée' : 'personnes trouvées'})
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {results.map((result) => (
              <div key={result.user.id} className="px-4 py-6 sm:p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{result.user.fullName}</h4>
                    <p className="text-sm text-gray-500">{result.user.email}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {result.user.role === 'developer' ? 'Développeur' : 
                       result.user.role === 'devops' ? 'DevOps Engineer' :
                       result.user.role === 'pm' ? 'Project Manager' :
                       result.user.role === 'architect' ? 'Architecte' : 'Admin'}
                    </p>
                  </div>
                  {isAdmin && (
                    <a
                      href={`/admin/user/${result.user.id}`}
                      className="text-sm text-blue-600 hover:text-blue-900"
                    >
                      Voir profil complet
                    </a>
                  )}
                </div>
                
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Compétences correspondantes</h5>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {result.skills.map((skillInfo) => (
                      <div key={skillInfo.skill.id} className="border rounded-md p-3 bg-gray-50">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">{skillInfo.skill.name}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                            {skillInfo.skill.type === 'hard' ? 'Tech' : 'Soft'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Niveau: {skillInfo.level} - {
                            skillInfo.level === 1 ? 'Débutant' :
                            skillInfo.level === 2 ? 'Intermédiaire' :
                            skillInfo.level === 3 ? 'Avancé' :
                            skillInfo.level === 4 ? 'Expert' :
                            'Maître'
                          }
                        </div>
                        {skillInfo.hasCertification && (
                          <div className="mt-1 text-xs">
                            <span className="text-green-600 font-medium">Certifié: </span>
                            {skillInfo.certifications && skillInfo.certifications.length > 0 ? (
                              <div className="ml-1">
                                {skillInfo.certifications.map((cert, index) => (
                                  <div key={cert.id} className={index > 0 ? 'mt-1' : ''}>
                                    {cert.name}
                                    {cert.date && ` (Obtenu le: ${new Date(cert.date).toLocaleDateString()})`}
                                    {cert.expiryDate && (
                                      <span className={`ml-1 ${
                                        new Date(cert.expiryDate) < new Date()
                                          ? 'text-red-600'
                                          : 'text-green-600'
                                      }`}>
                                        ({new Date(cert.expiryDate) < new Date()
                                          ? 'Expirée'
                                          : `Valide jusqu'au ${new Date(cert.expiryDate).toLocaleDateString()}`
                                        })
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <>
                                {skillInfo.certificationName}
                                {skillInfo.certificationExpiry && (
                                  <span className={`ml-1 ${
                                    new Date(skillInfo.certificationExpiry) < new Date()
                                      ? 'text-red-600'
                                      : 'text-green-600'
                                  }`}>
                                    ({new Date(skillInfo.certificationExpiry) < new Date()
                                      ? 'Expirée'
                                      : `Valide jusqu'au ${new Date(skillInfo.certificationExpiry).toLocaleDateString()}`
                                    })
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : searchTerm || skillFilter || certifiedOnly || minLevel > 1 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-500">Aucun résultat trouvé pour ces critères de recherche.</p>
        </div>
      ) : null}
    </div>
  );
} 