'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, FieldError } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Skill, UserSkill, Certification, Training } from '@/types';
import { Database, Tables } from '@/types/supabase';
import clsx from 'clsx';

// Define types for Family and Version based on Supabase schema
type SkillFamily = Tables<'skill_families'>;
type SkillVersion = Tables<'skill_versions'>;
// Use Supabase generated types for Insert operations
type CertificationInsert = Database['public']['Tables']['certifications']['Insert'];
type TrainingInsert = Database['public']['Tables']['trainings']['Insert'];
// Define type for UserSkill Update/Insert, ensuring comment is included
// Explicitly list fields to include instead of using Omit for clarity and safety
type UserSkillUpsert = {
  userid: string;
  skillid: string;
  level: number;
  comment: string | null;
  version_id: string | null;
  hascertification: boolean | null;
  hastrainings: boolean | null;
};

// Define a more specific type for UserSkill with nested data
type UserSkillWithDetails = UserSkill & {
  skill: (Skill & { family: SkillFamily }) | null;
  version: SkillVersion | null;
  comment?: string | null;
  certifications?: Certification[]; // Assuming Certification type aligns with Row type
  trainings?: Training[]; // Assuming Training type aligns with Row type
};

// Define a schema for a single certification
const certificationSchema = z.object({
  id: z.string().optional(), // Keep id optional for existing certs during edit
  name: z.string().min(1, 'Le nom de la certification est requis'),
  date: z.string().min(1, "La date d'obtention est requise"), // Use double quotes to avoid escaping
  expiryDate: z.string().optional().nullable(), // Allow empty string or null
});

// Define a schema for a single training
const trainingSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Le nom de la formation est requis'),
  date: z.string().min(1, 'La date de la formation est requise'),
  provider: z.string().optional().nullable(),
});

// Single unified schema - Hard skill fields are optional
const skillFormSchema = z.object({
  familyId: z.string().min(1, 'Veuillez sélectionner une famille'),
  skillId: z.string().min(1, 'Veuillez sélectionner une compétence'),
  level: z.string().min(1, 'Veuillez sélectionner un niveau'),
  comment: z.string().optional().nullable(),
  // Hard skill fields
  versionId: z.string().optional().nullable(),
  hasTrainings: z.boolean().optional(),
  trainings: z.array(trainingSchema).optional(),
  hasCertification: z.boolean().optional(),
  certifications: z.array(certificationSchema).optional(),
})
// Add refinements directly to the unified schema, but they will only be effectively
// checked by our manual validation logic in onSubmit for hard skills.
// Zod resolver will still run them, but we add manual checks before submission.
.refine(data => {
    // This refinement logic is effectively handled manually in onSubmit for hard skills
    // Always return true here to avoid Zod blocking based on optional fields for soft skills
    return true; 
    // Original logic (moved to onSubmit):
    // !data.hasCertification || (data.certifications && data.certifications.length > 0)
  }, {
    // We rely on manual setError in onSubmit for this message
    message: "Au moins une certification est requise si la case est cochée.", 
    path: ['certifications'], 
})
.refine(data => {
    // This refinement logic is effectively handled manually in onSubmit for hard skills
    return true; 
    // Original logic (moved to onSubmit):
    // !data.hasTrainings || (data.trainings && data.trainings.length > 0)
  }, {
    message: "Au moins une formation est requise si la case est cochée.",
    path: ['trainings'], 
});

// Define the type based on the unified schema
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
  const skillType = (searchParams.get('type') || 'hard') as 'hard' | 'soft';
  
  const [userSkills, setUserSkills] = useState<UserSkillWithDetails[]>([]);
  const [skillFamilies, setSkillFamilies] = useState<SkillFamily[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [skillVersions, setSkillVersions] = useState<SkillVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<UserSkillWithDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const { 
      register, 
      handleSubmit, 
      reset, 
      setValue, 
      watch, 
      control, 
      setError: setFormError,
      clearErrors,
      formState: { errors } 
  } = useForm<SkillFormValues>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      familyId: '',
      skillId: '',
      level: '',
      comment: '',
      versionId: '',
      hasTrainings: false,
      trainings: [],
      hasCertification: false,
      certifications: [],
    }
  });
  
  const { fields: certificationFields, append: appendCertification, remove: removeCertification } = useFieldArray({
    control,
    name: 'certifications',
  });
  
  const { fields: trainingFields, append: appendTraining, remove: removeTraining } = useFieldArray({
    control,
    name: 'trainings',
  });
  
  const hasCertification = watch('hasCertification');
  const hasTrainings = watch('hasTrainings');
  const watchedFamilyId = watch('familyId');
  const watchedSkillId = watch('skillId');
  const watchedCertifications = watch('certifications');
  const watchedTrainings = watch('trainings');
  
  const fetchInitialData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      // Fetch only families that have skills matching the current skillType
      const { data: familiesData, error: familiesError } = await supabase
        .from('skill_families')
        // We select the family columns and use an inner join (!) 
        // to ensure the family has at least one skill matching the type.
        .select('*, skills!inner(type)') 
        .eq('skills.type', skillType) // Filter based on the skill type
        .order('name');
        
      if (familiesError) throw familiesError;
      
      // Deduplicate families (inner join might return duplicates)
      const uniqueFamilies = familiesData 
        ? Array.from(new Map(familiesData.map(family => [family.id, family])).values())
        : [];
      setSkillFamilies(uniqueFamilies);

      // Fetch user skills with related data (already filtered by skillType)
      const { data: userSkillsData, error: userSkillsError } = await supabase
        .from('user_skills')
        .select(`
          *,
          skill:skills!inner(*, family:skill_families!inner(*)),
          version:skill_versions(*),
          certifications(*),
          trainings(*)
        `)
        .eq('userid', user.id)
        .eq('skill.type', skillType); // Filter by skill type

      if (userSkillsError) throw userSkillsError;
      
      // Map Supabase data to our detailed type
      const userSkillsWithDetails: UserSkillWithDetails[] = (userSkillsData || []).map(us => {
          // Supabase returns certifications/trainings as nested arrays
          const typedUS = us as any; // Use any temporarily for mapping
          return {
             ...us,
             id: typedUS.id,
             userId: typedUS.userid,
             skillId: typedUS.skillid,
             skill: typedUS.skill,
             version: typedUS.version,
             level: typedUS.level,
             comment: typedUS.comment,
             version_id: typedUS.version_id,
             hasCertification: (typedUS.certifications?.length > 0), // Determine based on fetched data
             certifications: typedUS.certifications?.map((cert: any) => ({
                 id: cert.id,
                 userskillId: cert.userskill_id,
                 name: cert.name,
                 date: cert.date,
                 expiryDate: cert.expiry_date,
                 createdAt: cert.created_at,
                 updatedAt: cert.updated_at
             })) || [],
             hasTrainings: (typedUS.trainings?.length > 0), // Determine based on fetched data
             trainings: typedUS.trainings?.map((train: any) => ({
                 id: train.id,
                 userskillId: train.userskill_id,
                 name: train.name,
                 date: train.date,
                 provider: train.provider,
                 createdAt: train.created_at,
                 updatedAt: train.updated_at
             })) || [],
          };
      });
      
      setUserSkills(userSkillsWithDetails);

    } catch (err: any) {
      console.error('Error fetching initial data:', err);
      setError('Une erreur est survenue lors du chargement des données initiales');
    } finally {
      setIsLoading(false);
    }
  }, [user, skillType]); // skillType is now a dependency

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const fetchSkillsByFamily = async () => {
      if (!watchedFamilyId) {
         setFilteredSkills([]);
         setValue('skillId', '');
         setValue('versionId', '');
         setSkillVersions([]);
         return;
      }
      if (isEditing && selectedSkill && watchedFamilyId === selectedSkill.skill?.family?.id) {
          return; 
      }

      try {
        const { data: skillsData, error: skillsError } = await supabase
          .from('skills')
          .select('*')
          .eq('family_id', watchedFamilyId)
          .eq('type', skillType)
          .order('name');
        if (skillsError) throw skillsError;
        setFilteredSkills(skillsData || []);
        if (!isEditing || watchedFamilyId !== selectedSkill?.skill?.family?.id) {
             setValue('skillId', '');
             setValue('versionId', '');
             setSkillVersions([]);
        }
      } catch (err: any) {
        console.error('Error fetching skills for family:', err);
        setError('Erreur lors du chargement des compétences');
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
    if (newType === skillType) return; // Do nothing if type hasn't changed
    router.push(`/skills?type=${newType}`);
    // Reset everything when type changes
    reset({ 
        familyId: '', skillId: '', level: '', comment: '',
        versionId: '', hasTrainings: false, trainings: [], hasCertification: false, certifications: [] 
    });
    // Remove state setters that no longer exist
    // setSelectedFamilyId(''); 
    // setSelectedSkillId(''); 
    setFilteredSkills([]);
    setSkillVersions([]);
    setIsEditing(false);
    setSelectedSkill(null);
    setError(null);
    setSuccess(null);
    clearErrors(); // Clear validation errors
  };

  const onSubmit = async (data: SkillFormValues) => {
    if (!user) return;

    clearErrors(['certifications', 'trainings']);
    setError(null);
    setSuccess(null);

    // Manual validation: Check if arrays are empty when checkboxes are true
    // This validation now applies regardless of skillType
    let validationOk = true;
    if (data.hasCertification && (!data.certifications || data.certifications.length === 0)) {
      setFormError('certifications', { type: 'manual', message: 'Veuillez ajouter au moins une certification ou décocher la case.' });
      validationOk = false;
    }
    if (data.hasTrainings && (!data.trainings || data.trainings.length === 0)) {
      setFormError('trainings', { type: 'manual', message: 'Veuillez ajouter au moins une formation ou décocher la case.' });
      validationOk = false;
    }

    if (!validationOk) {
      console.log("Manual validation failed for certifications/trainings requirements.");
      return; 
    }
    
    setIsSubmitting(true);

    // Prepare data for Supabase
    const skillDbData: UserSkillUpsert = {
      userid: user.id,
      skillid: data.skillId,
      level: parseInt(data.level, 10),
      comment: data.comment || null,
      // Include these fields regardless of type, their values come from the form
      version_id: data.versionId || null, 
      hascertification: data.hasCertification ?? false,
      hastrainings: data.hasTrainings ?? false,
    };

    let certificationsToInsert: CertificationInsert[] = [];
    let trainingsToInsert: TrainingInsert[] = [];

    // Prepare arrays for insertion if checkboxes are checked (regardless of skillType)
    if (skillDbData.hascertification && data.certifications) {
      certificationsToInsert = data.certifications
        .filter(cert => cert.name && cert.date) 
        .map(cert => ({
          userskill_id: '', // Placeholder
          name: cert.name,
          date: cert.date,
          expiry_date: cert.expiryDate || null,
        }));
    }
    if (skillDbData.hastrainings && data.trainings) {
      trainingsToInsert = data.trainings
        .filter(train => train.name && train.date)
        .map(train => ({
          userskill_id: '', // Placeholder
          name: train.name,
          date: train.date,
          provider: train.provider || null,
        }));
    }

    try {
      let userSkillId: string;

      // Upsert Logic (remains the same, checks for existing skill)
      let existingUserSkillId: string | null = null;
      if (isEditing && selectedSkill) {
        existingUserSkillId = selectedSkill.id;
      } else {
         // ... (fetch existing skill logic remains the same) ...
         const { data: existingSkill, error: fetchError } = await supabase
          .from('user_skills')
          .select('id')
          .eq('userid', user.id)
          .eq('skillid', data.skillId)
          .maybeSingle();
        if (fetchError) throw fetchError;
        if (existingSkill) existingUserSkillId = existingSkill.id;
      }

      if (existingUserSkillId) { // UPDATE path
        userSkillId = existingUserSkillId;
        const { error: updateError } = await supabase
          .from('user_skills')
          .update(skillDbData as any) // Use prepared data
          .eq('id', userSkillId);
        if (updateError) throw updateError;

        // Clear related certifications/trainings BEFORE adding new ones (regardless of skillType)
        const { error: delCertErr } = await supabase.from('certifications').delete().eq('userskill_id', userSkillId);
        if (delCertErr) console.warn("Error deleting old certifications:", delCertErr);
        const { error: delTrainErr } = await supabase.from('trainings').delete().eq('userskill_id', userSkillId);
        if (delTrainErr) console.warn("Error deleting old trainings:", delTrainErr);
        
      } else { // INSERT path
        const { data: insertData, error: insertError } = await supabase
          .from('user_skills')
          .insert(skillDbData as any) // Use prepared data
          .select('id')
          .single();
        if (insertError) throw insertError;
        userSkillId = insertData.id;
      }

      // Insert Certifications/Trainings if they exist (regardless of skillType)
      if (certificationsToInsert.length > 0) {
        const finalCerts = certificationsToInsert.map(c => ({ ...c, userskill_id: userSkillId }));
        const { error: certError } = await supabase.from('certifications').insert(finalCerts);
        if (certError) console.error("Error inserting certifications:", certError); 
      }
      if (trainingsToInsert.length > 0) {
        const finalTrainings = trainingsToInsert.map(t => ({ ...t, userskill_id: userSkillId }));
        const { error: trainError } = await supabase.from('trainings').insert(finalTrainings);
        if (trainError) console.error("Error inserting trainings:", trainError);
      }

      // ... (success message, reset, fetchInitialData remain the same) ...
      setSuccess(existingUserSkillId ? 'Compétence mise à jour avec succès' : 'Compétence ajoutée avec succès');
      
      reset({ 
        familyId: '', skillId: '', level: '', comment: '',
        versionId: '', hasTrainings: false, trainings: [], hasCertification: false, certifications: [] 
      });
      setFilteredSkills([]); 
      setSkillVersions([]);
      setIsEditing(false);
      setSelectedSkill(null);
      
      await fetchInitialData(); 

      setTimeout(() => {
        setSuccess(null);
      }, 3000);

    } catch (err: any) {
      // ... (error handling remains the same) ...
       console.error('Error managing skill:', err);
      const message = err.message || 'Une erreur est survenue.';
      setError(`Erreur: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEdit = useCallback(async (userSkill: UserSkillWithDetails) => {
      // ... (checks for userSkill.skill etc. remain the same) ...
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
  
      const familyId = userSkill.skill.family.id;
      const skillId = userSkill.skillId;
      const level = String(userSkill.level);
      const comment = userSkill.comment || '';
  
      // Prepare default values, including certs/trainings regardless of skillType
      const defaultEditValues: SkillFormValues = {
          familyId: familyId, 
          skillId: skillId,   
          level: level,
          comment: comment,
          // Use optional chaining and nullish coalescing for safety
          versionId: userSkill.version_id ?? '',
          hasCertification: userSkill.hasCertification ?? false,
          certifications: (userSkill.certifications ?? []).map(cert => ({
              id: cert.id,
              name: cert.name,
              date: cert.date, 
              expiryDate: cert.expiryDate || '' 
          })),
          hasTrainings: userSkill.hasTrainings ?? false,
          trainings: (userSkill.trainings ?? []).map(training => ({
              id: training.id,
              name: training.name,
              date: training.date,
              provider: training.provider || '' 
          })),
      };
      
      // Reset the form with the prepared values
      reset(defaultEditValues); 
  
      // Pre-fetch skills and versions (logic remains the same, including skillType check for versions)
      try {
        const { data: skillsData, error: skillsError } = await supabase
          .from('skills')
          .select('*')
          .eq('family_id', familyId)
          .eq('type', skillType) // Still use skillType here to fetch correct skills
          .order('name');
        if (skillsError) throw skillsError;
        setFilteredSkills(skillsData || []);
        
        if (skillType === 'hard' && skillId) { // Fetch versions only if hard skill
          const { data: versionsData, error: versionsError } = await supabase
            .from('skill_versions')
            .select('*')
            .eq('skill_id', skillId)
            .order('version_name');
          if (versionsError) throw versionsError;
          setSkillVersions(versionsData || []);
        } else {
            setSkillVersions([]); 
        }
      } catch (err: any) {
        console.error("Error pre-fetching data for edit form:", err);
        setError("Erreur lors de la préparation du formulaire de modification.");
      }
  
    }, [skillType, reset]); // Dependencies remain the same
  
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
    reset({ // Reset to initial empty state
        familyId: '', skillId: '', level: '', comment: '',
        versionId: '', hasTrainings: false, trainings: [], hasCertification: false, certifications: [] 
    });
    // Remove state setters that no longer exist
    // setSelectedFamilyId('');
    // setSelectedSkillId('');
    setFilteredSkills([]);
    setSkillVersions([]);
    setError(null); // Clear any errors
    clearErrors(); // Clear validation errors
  };
  
  // Helper function to add a new certification field
  const addCertification = () => {
    appendCertification({ name: '', date: '', expiryDate: '' });
  };
  
  // Helper function to add a new training field
  const addTraining = () => {
    appendTraining({ name: '', date: '', provider: '' });
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
        {!isEditing && (
          <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded border border-blue-200">
            Si vous sélectionnez une compétence que vous possédez déjà, les informations existantes seront mises à jour.
          </div>
        )}
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

            {/* Version (Only for Hard Skills) */}
            {skillType === 'hard' && (
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
            )}

            {/* Level (Always shown, adjust grid span for soft skills) */}
            <div className={clsx("lg:col-span-1", skillType === 'soft' && "md:col-start-3")}>
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

            {/* Trainings Section (Ensure ALWAYS SHOWN) */}
            <div className="md:col-span-2 lg:col-span-3 flex items-center space-x-3 pt-4 border-t mt-4">
              <input
                id="hasTrainings"
                type="checkbox"
                {...register('hasTrainings')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hasTrainings" className="text-sm font-medium text-gray-700">
                Formations suivies ?
              </label>
            </div>
            {/* Training Details (Show if checkbox is checked) */}
            {hasTrainings && (
              <div className="md:col-span-2 lg:col-span-3">
                <div className="border rounded-md p-4 mb-2 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-medium text-gray-700">Formations</h3>
                    <Button 
                      type="button" 
                      onClick={addTraining} 
                      variant="secondary" 
                      size="sm"
                    >
                      Ajouter une formation
                    </Button>
                  </div>
                  
                  {trainingFields.length === 0 && (
                    <p className="text-sm text-gray-500 mb-4">
                      Aucune formation ajoutée. Utilisez le bouton ci-dessus pour ajouter une formation.
                    </p>
                  )}
                  
                  {trainingFields.map((field, index) => (
                    <div key={field.id} className="border-t pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div>
                          <Input
                            label={`Nom de la formation ${index + 1}`}
                            id={`trainings.${index}.name`}
                            type="text"
                            {...register(`trainings.${index}.name` as const)}
                            error={errors.trainings?.[index]?.name?.message}
                          />
                        </div>
                        <div>
                          <Input
                            label="Date de la formation"
                            id={`trainings.${index}.date`}
                            type="date"
                            {...register(`trainings.${index}.date` as const)}
                            error={errors.trainings?.[index]?.date?.message}
                          />
                        </div>
                        <div>
                          <Input
                            label="Organisme de formation (Optionnel)"
                            id={`trainings.${index}.provider`}
                            type="text"
                            {...register(`trainings.${index}.provider` as const)}
                            error={errors.trainings?.[index]?.provider?.message}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          onClick={() => {
                            // Sauvegarde individuelle de cette formation
                            const currentTraining = {
                              name: watch(`trainings.${index}.name`),
                              date: watch(`trainings.${index}.date`),
                              provider: watch(`trainings.${index}.provider`)
                            };
                            
                            // Afficher un message de confirmation
                            if (currentTraining.name && currentTraining.date) {
                              setSuccess(`Formation "${currentTraining.name}" sauvegardée`);
                              setTimeout(() => {
                                setSuccess(null);
                              }, 3000);
                            } else {
                              setError("Veuillez remplir au moins le nom et la date de la formation");
                              setTimeout(() => {
                                setError(null);
                              }, 3000);
                            }
                          }}
                          variant="secondary"
                          size="sm"
                        >
                          Sauvegarder
                        </Button>
                        <Button
                          type="button"
                          onClick={() => removeTraining(index)}
                          variant="danger"
                          size="sm"
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {errors.trainings && (
                  <p className="mt-1 text-sm text-red-600">{errors.trainings.message as string}</p>
                )}
              </div>
            )}
            
            {/* Certifications Section (Ensure ALWAYS SHOWN) */}
            <div className="md:col-span-2 lg:col-span-3 flex items-center space-x-3 pt-4 border-t mt-4">
              <input
                id="hasCertification"
                type="checkbox"
                {...register('hasCertification')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hasCertification" className="text-sm font-medium text-gray-700">
                Certifications associées ?
              </label>
            </div>
             {/* Certification Details (Show if checkbox is checked) */}
            {hasCertification && (
              <div className="md:col-span-2 lg:col-span-3">
                <div className="border rounded-md p-4 mb-2 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-medium text-gray-700">Certifications</h3>
                    <Button 
                      type="button" 
                      onClick={addCertification} 
                      variant="secondary" 
                      size="sm"
                    >
                      Ajouter une certification
                    </Button>
                  </div>
                  
                  {certificationFields.length === 0 && (
                    <p className="text-sm text-gray-500 mb-4">
                      Aucune certification ajoutée. Utilisez le bouton ci-dessus pour ajouter une certification.
                    </p>
                  )}
                  
                  {certificationFields.map((field, index) => (
                    <div key={field.id} className="border-t pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div>
                          <Input
                            label={`Nom de la certification ${index + 1}`}
                            id={`certifications.${index}.name`}
                            type="text"
                            {...register(`certifications.${index}.name` as const)}
                            error={errors.certifications?.[index]?.name?.message}
                          />
                        </div>
                        <div>
                          <Input
                            label="Date d'obtention"
                            id={`certifications.${index}.date`}
                            type="date"
                            {...register(`certifications.${index}.date` as const)}
                            error={errors.certifications?.[index]?.date?.message}
                          />
                        </div>
                        <div>
                          <Input
                            label="Date d'expiration (Optionnel)"
                            id={`certifications.${index}.expiryDate`}
                            type="date"
                            {...register(`certifications.${index}.expiryDate` as const)}
                            error={errors.certifications?.[index]?.expiryDate?.message}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          onClick={() => {
                            // Sauvegarde individuelle de cette certification
                            const currentCertification = {
                              name: watch(`certifications.${index}.name`),
                              date: watch(`certifications.${index}.date`),
                              expiryDate: watch(`certifications.${index}.expiryDate`)
                            };
                            
                            // Afficher un message de confirmation
                            if (currentCertification.name && currentCertification.date) {
                              setSuccess(`Certification "${currentCertification.name}" sauvegardée`);
                              setTimeout(() => {
                                setSuccess(null);
                              }, 3000);
                            } else {
                              setError("Veuillez remplir au moins le nom et la date de la certification");
                              setTimeout(() => {
                                setError(null);
                              }, 3000);
                            }
                          }}
                          variant="secondary"
                          size="sm"
                        >
                          Sauvegarder
                        </Button>
                        <Button
                          type="button"
                          onClick={() => removeCertification(index)}
                          variant="danger"
                          size="sm"
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {errors.certifications && (
                  <p className="mt-1 text-sm text-red-600">{errors.certifications.message as string}</p>
                )}
              </div>
            )}

            {/* Comment Field (Always shown) */}
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
             <div className="text-center py-10 text-gray-500">Chargement...</div>
           ) : filteredUserSkills.length > 0 ? (
            <ul role="list" className="divide-y divide-gray-200">
              {filteredUserSkills.map((userSkill) => (
                <li key={userSkill.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition duration-150 ease-in-out">
                  <div className="flex items-center justify-between flex-wrap gap-y-2">
                    <div className="truncate flex-grow pr-4">
                      <p className="text-sm font-medium text-blue-600 truncate">
                         {userSkill.skill?.family?.name} / {userSkill.skill?.name}
                         {/* Version still only shown for hard skills */}
                         {skillType === 'hard' && userSkill.version?.version_name && ` (${userSkill.version.version_name})`}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center flex-wrap gap-x-2">
                         <span>Niveau: <span className="font-semibold">{getLevelDescription(Number(userSkill.level))}</span></span>
                         {/* Certification Badge (ALWAYS SHOWN if hasCertification) */}
                         {userSkill.hasCertification && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Certifié
                          </span>
                        )}
                        {/* Training Badge (ALWAYS SHOWN if hasTrainings) */}
                        {userSkill.hasTrainings && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Formation(s)
                          </span>
                        )}
                      </p>
                      {/* Trainings List (ALWAYS SHOWN if trainings exist) */}
                      {userSkill.trainings && userSkill.trainings.length > 0 && (
                        <details className="mt-1 group">
                           <summary className="text-xs text-gray-500 font-semibold cursor-pointer hover:text-gray-700 list-none group-open:mb-1">
                                Formations ({userSkill.trainings.length}) <span className="group-open:hidden">&#9658;</span><span className="hidden group-open:inline">&#9660;</span>
                           </summary>
                          <ul className="list-disc pl-5 space-y-0.5">
                            {userSkill.trainings.map((training) => (
                              <li key={training.id} className="text-xs text-gray-600">
                                {training.name}
                                {training.date && ` (${new Date(training.date).toLocaleDateString()})`}
                                {training.provider && ` - ${training.provider}`}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {/* Certifications List (ALWAYS SHOWN if certifications exist) */}
                      {userSkill.certifications && userSkill.certifications.length > 0 && (
                         <details className="mt-1 group">
                            <summary className="text-xs text-gray-500 font-semibold cursor-pointer hover:text-gray-700 list-none group-open:mb-1">
                                Certifications ({userSkill.certifications.length}) <span className="group-open:hidden">&#9658;</span><span className="hidden group-open:inline">&#9660;</span>
                           </summary>
                           <ul className="list-disc pl-5 space-y-0.5">
                            {userSkill.certifications.map((cert) => (
                              <li key={cert.id} className="text-xs text-gray-600">
                                {cert.name}
                                {cert.date && ` (Obtenu: ${new Date(cert.date).toLocaleDateString()})`}
                                {cert.expiryDate && ` (Expire: ${new Date(cert.expiryDate).toLocaleDateString()})`}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                       {/* Comment Display (Always shown if exists) */}
                       {userSkill.comment && (
                           <p className="text-xs text-gray-500 mt-1 italic">Commentaire: {userSkill.comment}</p>
                       )}
                    </div>
                     {/* Action Buttons */}
                    <div className="flex-shrink-0 flex space-x-2">
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
                 Aucune compétence de type '{skillType === 'hard' ? 'Technique' : 'Soft Skill'}' ajoutée pour le moment.
               </p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
