'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Skill, UserSkill } from '@/types';
import { Database, Tables } from '@/types/supabase';
import clsx from 'clsx';

// Define types for Family and Version based on Supabase schema
type SkillFamily = Tables<'skill_families'>;
type SkillVersion = Tables<'skill_versions'>;

// Define a more specific type for UserSkill with nested data
type UserSkillWithDetails = UserSkill & {
  skill: (Skill & { family: SkillFamily }) | null;
  version: SkillVersion | null;
  comment?: string | null;
};

const skillFormSchema = z.object({
  familyId: z.string().min(1, 'Veuillez sélectionner une famille'),
  skillId: z.string().min(1, 'Veuillez sélectionner une compétence'),
  versionId: z.string().optional(),
  level: z.string().min(1, 'Veuillez sélectionner un niveau'),
  hasCertification: z.boolean(),
  certificationName: z.string().optional(),
  certificationDate: z.string().optional(),
  certificationExpiry: z.string().optional(),
  comment: z.string().optional(),
}).refine(data => !data.hasCertification || (data.certificationName && data.certificationDate), {
  message: "Le nom et la date de certification sont requis si 'Possède une certification' est coché.",
  path: ['certificationName'],
});

type SkillFormValues = z.infer<typeof skillFormSchema>;

// Helper function to map level number to description
const getLevelDescription = (level: number): string => {
  switch (level) {
    case 1: return 'Débutant';
    case 2: return 'Intermédiaire';
    case 3: return 'Avancé';
    case 4: return 'Expert';
    case 5: return 'Maître';
    default: return 'Inconnu';
  }
};

export default function SkillsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const skillType = searchParams.get('type') || 'hard';
  
  const [userSkills, setUserSkills] = useState<UserSkillWithDetails[]>([]);
  const [skillFamilies, setSkillFamilies] = useState<SkillFamily[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [skillVersions, setSkillVersions] = useState<SkillVersion[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<UserSkillWithDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors }, control } = useForm<SkillFormValues>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      familyId: '',
      skillId: '',
      versionId: '',
      level: '',
      hasCertification: false,
      certificationName: '',
      certificationDate: '',
      certificationExpiry: '',
      comment: '',
    }
  });
  
  const hasCertification = watch('hasCertification');
  const watchedFamilyId = watch('familyId');
  const watchedSkillId = watch('skillId');
  
  const fetchInitialData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: familiesData, error: familiesError } = await supabase
        .from('skill_families')
        .select('*')
        .order('name');
      if (familiesError) throw familiesError;
      setSkillFamilies(familiesData || []);

      const { data: userSkillsData, error: userSkillsError } = await supabase
        .from('user_skills')
        .select(`
          *,
          skill:skills!inner(*, family:skill_families!inner(*)),
          version:skill_versions(*)
        `)
        .eq('userid', user.id)
        .eq('skill.type', skillType);

      if (userSkillsError) throw userSkillsError;
      setUserSkills((userSkillsData as UserSkillWithDetails[]) || []);

    } catch (err: any) {
      console.error('Error fetching initial data:', err);
      setError('Une erreur est survenue lors du chargement des données initiales');
    } finally {
      setIsLoading(false);
    }
  }, [user, skillType]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Fetch skills when family changes (but not during initial edit load)
  useEffect(() => {
    const fetchSkillsByFamily = async () => {
      // Don't run if no family selected OR if we are editing (handleEdit takes care of initial load)
      if (!watchedFamilyId || isEditing) {
          if (!isEditing && !watchedFamilyId) { // Clear skills if family is deselected when not editing
             setFilteredSkills([]);
             setValue('skillId', '');
             setValue('versionId', '');
          }
        return;
      }

      try {
        setIsLoading(true); // Indicate loading state
        const { data: skillsData, error: skillsError } = await supabase
          .from('skills')
          .select('*')
          .eq('family_id', watchedFamilyId)
          .eq('type', skillType) // Ensure we respect the skill type toggle
          .order('name');

        if (skillsError) throw skillsError;

        // Filter out skills already added by the user (when ADDING a new skill)
        const currentUsersSkillIds = userSkills.map(us => us.skillId);
        const skillsForDropdown = (skillsData || []).filter(
          (skill: Skill) => skill.id && !currentUsersSkillIds.includes(skill.id)
        );

        setFilteredSkills(skillsForDropdown);
        setValue('skillId', ''); // Reset skill selection when family changes
        setValue('versionId', ''); // Reset version selection
        setSkillVersions([]); // Clear versions
      } catch (err: any) {
        console.error('Error fetching skills for family:', err);
        setError('Erreur lors du chargement des compétences pour la famille sélectionnée');
        setFilteredSkills([]); // Clear skills on error
      } finally {
        setIsLoading(false); // Finish loading
      }
    };

    fetchSkillsByFamily();
  // Watch familyId, but also depend on isEditing, userSkills, skillType, setValue to ensure correct behavior
  }, [watchedFamilyId, isEditing, userSkills, skillType, setValue]);

  useEffect(() => {
    const fetchVersionsBySkill = async () => {
      // Do not run this effect if we are currently in the process of setting up the edit form
      if (isEditing) {
        return;
      }

      if (!watchedSkillId) {
        setSkillVersions([]);
        setValue('versionId', '');
        return;
      }
      try {
        // No need for setIsLoading here as it might conflict with other loading states
        const { data: versionsData, error: versionsError } = await supabase
          .from('skill_versions')
          .select('*')
          .eq('skill_id', watchedSkillId)
          .order('version_name');

        if (versionsError) throw versionsError;
        setSkillVersions(versionsData || []);
        // Don't reset versionId here automatically, let user choose or handleEdit set it
        // setValue('versionId', ''); 
      } catch (err: any) {
        console.error('Error fetching skill versions:', err);
        setError('Erreur lors du chargement des versions');
        setSkillVersions([]); // Clear versions on error
      }
    };

    fetchVersionsBySkill();
  }, [watchedSkillId, setValue, isEditing]); // Add isEditing dependency
  
  // Function to handle changing the skill type filter
  const handleSkillTypeChange = (newType: 'hard' | 'soft') => {
    router.push(`/skills?type=${newType}`);
    // Reset form and selections when type changes
    reset();
    setSelectedFamilyId('');
    setSelectedSkillId('');
    setFilteredSkills([]);
    setSkillVersions([]);
    setIsEditing(false);
    setSelectedSkill(null);
    setError(null);
    setSuccess(null);
  };

  const onSubmit = async (data: SkillFormValues) => {
    if (!user) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    const skillData = {
      userid: user.id,
      skillid: data.skillId,
      version_id: data.versionId || null,
      level: parseInt(data.level, 10),
      hascertification: data.hasCertification,
      certificationname: data.hasCertification ? data.certificationName : null,
      certificationdate: data.hasCertification ? data.certificationDate : null,
      certificationexpiry: data.hasCertification ? data.certificationExpiry : null,
      comment: data.comment,
    };

    try {
      if (isEditing && selectedSkill) {
        const { error: updateError } = await supabase
          .from('user_skills')
          .update({
            version_id: data.versionId || null,
            level: parseInt(data.level, 10),
            hascertification: data.hasCertification,
            certificationname: data.hasCertification ? data.certificationName : null,
            certificationdate: data.hasCertification ? data.certificationDate : null,
            certificationexpiry: data.hasCertification ? data.certificationExpiry : null,
            comment: data.comment,
          })
          .eq('id', selectedSkill.id);
        
        if (updateError) throw updateError;
        
        setSuccess('Compétence mise à jour avec succès');
      } else {
        const { error: insertError } = await supabase
          .from('user_skills')
          .insert(skillData);
        
        if (insertError) throw insertError;
        
        setSuccess('Compétence ajoutée avec succès');
      }
      
      reset();
      setSelectedFamilyId('');
      setSelectedSkillId('');
      setFilteredSkills([]);
      setSkillVersions([]);
      setIsEditing(false);
      setSelectedSkill(null);
      
      await fetchInitialData();
      
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error managing skill:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEdit = useCallback(async (userSkill: UserSkillWithDetails) => {
    if (!userSkill.skill || !userSkill.skill.family) {
      console.error("Missing skill or family data for editing:", userSkill);
      setError("Données de compétence incomplètes pour la modification.");
      return;
    }

    setIsEditing(true);
    setSelectedSkill(userSkill);
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Extract all information we'll need
    const familyId = userSkill.skill.family.id;
    const rawUserSkill = userSkill as any;
    const skillId = rawUserSkill.skillid || userSkill.skillId;
    const versionId = userSkill.version_id || '';
    const level = String(userSkill.level);
    const hasCertification = userSkill.hasCertification || false;
    const certificationName = userSkill.certificationName || '';
    const certificationDate = userSkill.certificationDate || '';
    const certificationExpiry = userSkill.certificationExpiry || '';
    const comment = userSkill.comment || '';
    
    // STEP 1: Set up a reference to track when all cascading operations are complete
    let editSetupComplete = false;
    
    // STEP 2: First, reset form with just the non-cascading fields
    reset({
      familyId: '', // Start with empty to avoid triggering effects
      skillId: '',
      versionId: '',
      level: level,
      hasCertification: hasCertification,
      certificationName: certificationName,
      certificationDate: certificationDate, 
      certificationExpiry: certificationExpiry,
      comment: comment,
    });
    
    // STEP 3: Fetch all skills for this family to populate dropdown
    try {
      const { data: skillsData, error: skillsError } = await supabase
        .from('skills')
        .select('*')
        .eq('family_id', familyId)
        .eq('type', skillType)
        .order('name');
      
      if (skillsError) throw skillsError;

      // STEP 4: Set filtered skills but don't trigger setValue yet
      setFilteredSkills(skillsData || []);
      
      // STEP 5: Now set the familyId which will cascade
      setValue('familyId', familyId);
      
      // STEP 6: Wait a moment for React to update the UI with skills
      setTimeout(() => {
        // STEP 7: Now set the skillId after skills are loaded in the dropdown
        setValue('skillId', skillId);
        
        // STEP 8: If there's a version, fetch versions for this skill and set versionId
        if (skillId) {
          // Use an async IIFE to handle version fetching and setting
          (async () => {
            try {
              const { data: versionsData, error: versionsError } = await supabase
                .from('skill_versions')
                .select('*')
                .eq('skill_id', skillId)
                .order('version_name');
                
              if (versionsError) throw versionsError;
              
              setSkillVersions(versionsData || []);
              
              // Wait a moment to ensure the versions dropdown has been updated with options
              setTimeout(() => {
                if (versionId) {
                  setValue('versionId', versionId);
                }
                
                // STEP 10: Mark setup as complete
                editSetupComplete = true;
              }, 50); // Small delay to ensure versions dropdown is updated
            } catch (err) {
              console.error('[handleEdit] Error handling versions:', err);
            }
          })();
        } else {
          // No skill ID, so we're done
          editSetupComplete = true;
        }
      }, 100);  // Small delay to ensure React has updated the DOM
      
    } catch (err: any) {
      console.error("Error preparing edit form:", err);
      setError("Erreur lors de la préparation du formulaire de modification.");
      cancelEdit();
    }

  }, [userSkills, skillType, setValue, reset]);
  
  const handleDelete = async (userSkill: UserSkillWithDetails) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette compétence ?')) return;
    
    const originalUserSkills = [...userSkills];
    setUserSkills(prev => prev.filter(us => us.id !== userSkill.id));
    setError(null);
    
    try {
      const { error: deleteError } = await supabase
        .from('user_skills')
        .delete()
        .eq('id', userSkill.id);
      
      if (deleteError) throw deleteError;
      
      setSuccess('Compétence supprimée avec succès');
      await fetchInitialData();
      
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error deleting skill:', err);
      setError(err.message || 'Une erreur est survenue lors de la suppression');
      setUserSkills(originalUserSkills);
    }
  };
  
  const cancelEdit = () => {
    setIsEditing(false);
    setSelectedSkill(null);
    reset();
    setSelectedFamilyId('');
    setSelectedSkillId('');
    setFilteredSkills([]);
    setSkillVersions([]);
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
        <p className="mt-2 text-gray-600">Veuillez vous connecter pour gérer vos compétences</p>
      </div>
    );
  }
  
  const filteredUserSkills = userSkills.filter(
    us => us.skill && us.skill.family
  );
  
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Mes Compétences ({skillType === 'hard' ? 'Techniques' : 'Soft Skills'})
      </h1>

      {/* Skill Type Toggle */}
      <div className="mb-6 flex space-x-2">
        <Button
          onClick={() => handleSkillTypeChange('hard')}
          variant={skillType === 'hard' ? 'primary' : 'secondary'}
          className={clsx(
            "px-4 py-2 rounded-md text-sm font-medium",
            skillType === 'hard'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          )}
        >
          Hard Skills
        </Button>
        <Button
          onClick={() => handleSkillTypeChange('soft')}
          variant={skillType === 'soft' ? 'primary' : 'secondary'}
          className={clsx(
            "px-4 py-2 rounded-md text-sm font-medium",
            skillType === 'soft'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          )}
        >
          Soft Skills
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Erreur !</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Succès !</strong>
          <span className="block sm:inline"> {success}</span>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg p-6 mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          {isEditing ? 'Modifier la Compétence' : 'Ajouter une Compétence'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label htmlFor="familyId" className="block text-sm font-medium text-gray-700 mb-1">
                Famille <span className="text-red-500">*</span>
              </label>
              <select
                id="familyId"
                {...register('familyId')}
                className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${errors.familyId ? 'border-red-500' : ''}`}
                disabled={isEditing}
              >
                <option value="">-- Sélectionner une famille --</option>
                {skillFamilies.map((family) => (
                  <option key={family.id} value={family.id}>{family.name}</option>
                ))}
              </select>
              {errors.familyId && <p className="mt-1 text-sm text-red-600">{errors.familyId.message}</p>}
            </div>

            <div>
              <label htmlFor="skillId" className="block text-sm font-medium text-gray-700 mb-1">
                Compétence <span className="text-red-500">*</span>
              </label>
              <select
                id="skillId"
                {...register('skillId')}
                className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${errors.skillId ? 'border-red-500' : ''}`}
                disabled={!watchedFamilyId}
              >
                <option value="">-- Sélectionner une compétence --</option>
                {filteredSkills.map((skill) => (
                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                ))}
              </select>
              {errors.skillId && <p className="mt-1 text-sm text-red-600">{errors.skillId.message}</p>}
            </div>

            <div>
              <label htmlFor="versionId" className="block text-sm font-medium text-gray-700 mb-1">
                Version (Optionnel)
              </label>
              <select
                id="versionId"
                {...register('versionId')}
                className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${errors.versionId ? 'border-red-500' : ''}`}
                disabled={!watchedSkillId || skillVersions.length === 0}
              >
                <option value="">-- Sélectionner une version --</option>
                {skillVersions.map((version) => (
                  <option key={version.id} value={version.id}>{version.version_name}</option>
                ))}
              </select>
              {errors.versionId && <p className="mt-1 text-sm text-red-600">{errors.versionId.message}</p>}
            </div>

            <div className="lg:col-span-1">
               <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                Niveau <span className="text-red-500">*</span>
              </label>
              <select
                id="level"
                {...register('level')}
                className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${errors.level ? 'border-red-500' : ''}`}
              >
                 <option value="">-- Sélectionner un niveau --</option>
                 {[1, 2, 3, 4, 5].map((levelValue) => (
                  <option key={levelValue} value={levelValue}>
                    {getLevelDescription(levelValue)}
                  </option>
                ))}
              </select>
              {errors.level && <p className="mt-1 text-sm text-red-600">{errors.level.message}</p>}
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex items-center space-x-3 pt-4">
               <input
                id="hasCertification"
                type="checkbox"
                 {...register('hasCertification')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hasCertification" className="text-sm font-medium text-gray-700">
                Possède une certification associée
              </label>
            </div>

             {hasCertification && (
              <>
                <div className="lg:col-span-1">
                  <Input
                    label="Nom de la certification"
                    id="certificationName"
                    type="text"
                    {...register('certificationName')}
                    error={errors.certificationName?.message}
                  />
                </div>
                <div className="lg:col-span-1">
                   <Input
                    label="Date d'obtention"
                    id="certificationDate"
                    type="date"
                    {...register('certificationDate')}
                    error={errors.certificationDate?.message}
                  />
                </div>
                <div className="lg:col-span-1">
                  <Input
                    label="Date d'expiration (Optionnel)"
                    id="certificationExpiry"
                    type="date"
                    {...register('certificationExpiry')}
                    error={errors.certificationExpiry?.message}
                  />
                </div>
              </>
            )}

            {/* Comment Field */}
            <div className="col-span-1 md:col-span-3">
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">Commentaire (Optionnel)</label>
              <textarea
                id="comment"
                {...register('comment')}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Ajouter un commentaire..."
                disabled={isSubmitting}
              />
              {errors.comment && <p className="mt-1 text-sm text-red-600">{errors.comment.message}</p>}
            </div>
          </div>

           <div className="flex justify-end space-x-3 pt-5">
             {isEditing && (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                Annuler
              </Button>
            )}
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              {isEditing ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
         <div className="px-4 py-5 sm:px-6 bg-gray-50">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Mes compétences ({skillType === 'hard' ? 'Techniques' : 'Soft Skills'}) enregistrées
          </h3>
        </div>
        <div className="border-t border-gray-200">
          {isLoading ? (
             <div className="text-center py-10">Chargement...</div>
           ) : filteredUserSkills.length > 0 ? (
            <ul role="list" className="divide-y divide-gray-200">
              {filteredUserSkills.map((userSkill: UserSkillWithDetails) => (
                <li key={userSkill.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition duration-150 ease-in-out">
                  <div className="flex items-center justify-between">
                    <div className="truncate">
                      <p className="text-sm font-medium text-blue-600 truncate">
                         {userSkill.skill?.family?.name} / {userSkill.skill?.name}
                         {userSkill.version?.version_name && ` (${userSkill.version.version_name})`}
                      </p>
                      <p className="text-sm text-gray-500">
                         {/* Ensure level is treated as number for description */}
                         Niveau: <span className="font-semibold">{getLevelDescription(Number(userSkill.level))}</span>
                         {userSkill.hasCertification && (
                           <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Certifié
                          </span>
                        )}
                      </p>
                       {userSkill.hasCertification && (
                         <p className="text-xs text-gray-500 mt-1">
                          {userSkill.certificationName}
                           {userSkill.certificationDate && ` (Obtenu le: ${new Date(userSkill.certificationDate).toLocaleDateString()})`}
                           {userSkill.certificationExpiry && ` (Expire le: ${new Date(userSkill.certificationExpiry).toLocaleDateString()})`}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex-shrink-0 flex space-x-2">
                      <Button
                         variant="secondary"
                        size="sm"
                         onClick={() => handleEdit(userSkill)}
                         aria-label={`Modifier ${userSkill.skill?.name}`}
                       >
                         Modifier
                      </Button>
                      <Button
                         variant="danger"
                        size="sm"
                         onClick={() => handleDelete(userSkill)}
                         aria-label={`Supprimer ${userSkill.skill?.name}`}
                       >
                         Supprimer
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10 px-4 sm:px-6">
              <p className="text-sm text-gray-500">
                Vous n'avez pas encore ajouté de compétences de type '{skillType === 'hard' ? 'Technique' : 'Soft Skill'}'.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
