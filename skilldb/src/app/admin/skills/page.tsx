'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Database } from '@/types/supabase'; // Import the generated types
import { useRouter, useSearchParams } from 'next/navigation'; // Import router and searchParams
import clsx from 'clsx'; // Import clsx

// Define types based on Supabase schema
type Skill = Database['public']['Tables']['skills']['Row'];
type SkillVersion = Database['public']['Tables']['skill_versions']['Row'];
type SkillFamily = Database['public']['Tables']['skill_families']['Row'];
type SkillInsert = Database['public']['Tables']['skills']['Insert'];
type SkillUpdate = Database['public']['Tables']['skills']['Update'];
type SkillVersionInsert = Database['public']['Tables']['skill_versions']['Insert'];

// Combine Skill with its versions and family name for easier state management
interface SkillWithDetails extends Skill {
  versions: SkillVersion[];
  family_name?: string;
}

// Zod schema for form validation
const skillSchema = z.object({
  name: z.string().min(1, 'Le nom de la compétence est requis'),
  family_id: z.string().uuid('Sélectionnez une famille valide'),
  description: z.string().optional(),
  versions: z.array(z.object({
    id: z.string().optional(), // For existing versions during update
    version_name: z.string().min(1, 'Le nom de la version est requis'),
  })).optional(),
});

type SkillFormValues = z.infer<typeof skillSchema>;

export default function AdminSkillsPage() {
  const [skillsWithDetails, setSkillsWithDetails] = useState<SkillWithDetails[]>([]);
  const [families, setFamilies] = useState<SkillFamily[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillWithDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter(); // Initialize router
  const searchParams = useSearchParams(); // Initialize searchParams
  const skillType = (searchParams.get('type') as 'hard' | 'soft') || 'hard'; // Get skill type from URL, default 'hard'

  // Form setup
  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<SkillFormValues>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      name: '',
      family_id: '',
      description: '',
      versions: [],
    },
  });

  // Field array for managing dynamic versions
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'versions',
  });

  // Fetch data function
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Filter skills by type
      const skillsQuery = supabase
        .from('skills')
        .select('*')
        .eq('type', skillType) // Add filter here
        .order('name');

      const [skillsRes, versionsRes, familiesRes] = await Promise.all([
        skillsQuery, // Use the filtered query
        supabase.from('skill_versions').select('*'),
        supabase.from('skill_families').select('*').order('name')
      ]);

      if (skillsRes.error) throw skillsRes.error;
      if (versionsRes.error) throw versionsRes.error;
      if (familiesRes.error) throw familiesRes.error;

      const skillsData = skillsRes.data;
      const versionsData = versionsRes.data;
      const familiesData = familiesRes.data;

      setFamilies(familiesData);

      const familyMap = new Map(familiesData.map(f => [f.id, f.name]));

      const combinedData: SkillWithDetails[] = skillsData.map(skill => ({
        ...skill,
        versions: versionsData.filter(v => v.skill_id === skill.id),
        family_name: skill.family_id ? familyMap.get(skill.family_id) : 'Inconnue',
      }));

      setSkillsWithDetails(combinedData);

    } catch (err: any) {
      console.error('Error fetching skills data:', err);
      setError('Erreur lors du chargement des données.');
    } finally {
      setIsLoading(false);
    }
  }, [skillType]); // Add skillType dependency

  // Fetch data on component mount and when skillType changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Function to handle changing the skill type filter
  const handleSkillTypeChange = (newType: 'hard' | 'soft') => {
    router.push(`/admin/skills?type=${newType}`);
    resetForm(); // Reset form when type changes
    setError(null);
    setSuccess(null);
  };

  // Handle form submission (Create/Update)
  const onSubmit = async (data: SkillFormValues) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const skillPayload: Omit<SkillInsert, 'id' | 'createdat'> | Omit<SkillUpdate, 'id' | 'createdat'> = {
        name: data.name,
        family_id: data.family_id,
        description: data.description || null,
        type: skillType, // Use the selected skillType here
      };

      let skillId: string;
      let successMessage: string;

      if (isEditing && selectedSkill) {
        skillId = selectedSkill.id;
        const { error: updateError } = await supabase
          .from('skills')
          .update(skillPayload)
          .eq('id', skillId);

        if (updateError) throw updateError;
        successMessage = 'Compétence mise à jour avec succès.';

        const existingVersionIds = selectedSkill.versions.map(v => v.id);
        const submittedVersionNames = data.versions?.map(v => v.version_name) || [];
        const versionsToAdd = data.versions?.filter(v => !v.id) || [];
        const versionsToKeepIds = data.versions?.map(v => v.id).filter(Boolean) as string[] || [];

        const versionsToDeleteIds = existingVersionIds.filter(id => !versionsToKeepIds.includes(id));
        if (versionsToDeleteIds.length > 0) {
            const { error: deleteVersionsError } = await supabase
                .from('skill_versions')
                .delete()
                .in('id', versionsToDeleteIds);
            if (deleteVersionsError) throw deleteVersionsError;
        }

        if (versionsToAdd.length > 0) {
          const newVersionsPayload: SkillVersionInsert[] = versionsToAdd.map(v => ({
            skill_id: skillId,
            version_name: v.version_name,
          }));
          const { error: addVersionsError } = await supabase
            .from('skill_versions')
            .insert(newVersionsPayload);
          if (addVersionsError) throw addVersionsError;
        }

      } else {
        const { data: newSkillData, error: insertError } = await supabase
          .from('skills')
          .insert(skillPayload as SkillInsert)
          .select('id')
          .single();

        if (insertError) throw insertError;
        if (!newSkillData) throw new Error("Failed to get ID for new skill.");

        skillId = newSkillData.id;
        successMessage = 'Compétence ajoutée avec succès.';

        if (data.versions && data.versions.length > 0) {
          const versionsPayload: SkillVersionInsert[] = data.versions.map(v => ({
            skill_id: skillId,
            version_name: v.version_name,
          }));
          const { error: versionsError } = await supabase
            .from('skill_versions')
            .insert(versionsPayload);
          if (versionsError) throw versionsError;
        }
      }

      setSuccess(successMessage);
      resetForm();
      fetchData();

      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error('Error managing skill:', err);
      if (err.message?.includes('duplicate key value violates unique constraint')) {
         setError('Erreur: Une compétence ou version avec ces détails existe déjà.');
      } else {
          setError(err.message || 'Une erreur est survenue.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle editing a skill
  const handleEdit = (skill: SkillWithDetails) => {
    setSelectedSkill(skill);
    setIsEditing(true);
    setError(null);
    setSuccess(null);

    setValue('name', skill.name);
    setValue('family_id', skill.family_id || '');
    setValue('description', skill.description || '');
    setValue('versions', skill.versions.map(v => ({ id: v.id, version_name: v.version_name || '' })));
  };

  // Handle deleting a skill
  const handleDelete = async (skill: SkillWithDetails) => {
    const displayName = `${skill.name} (${skill.family_name || 'Famille inconnue'})`;
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la compétence "${displayName}" et toutes ses versions associées ?`)) return;

    setError(null);
    setSuccess(null);
    try {
      const { error: deleteError } = await supabase
        .from('skills')
        .delete()
        .eq('id', skill.id);

      if (deleteError) throw deleteError;

      setSuccess('Compétence supprimée avec succès.');
      fetchData();
      resetForm();

      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error('Error deleting skill:', err);
      setError(err.message || 'Erreur lors de la suppression.');
    }
  };

  // Reset form and editing state
  const resetForm = () => {
    reset();
    setIsEditing(false);
    setSelectedSkill(null);
    remove(fields.map((_, index) => index));
  };

  // --- Render ---
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Compétences</h1>

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

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md" role="alert">
          {success}
        </div>
      )}

      {/* Add/Edit Form Card */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
        <div className="px-4 py-5 sm:px-6 bg-gray-50">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {isEditing ? 'Modifier une compétence' : 'Ajouter une compétence'}
          </h3>
        </div>

        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Skill Fields */}
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <Input
                  label="Nom de la Compétence"
                  type="text"
                  {...register('name')}
                  error={errors.name?.message}
                  required
                />
              </div>
              <div className="sm:col-span-3">
                <Select
                  label="Famille"
                  {...register('family_id')}
                  error={errors.family_id?.message}
                  required
                >
                  <option value="" disabled>-- Sélectionnez une famille --</option>
                  {families.map(family => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-6">
                 <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                   Description (Optionnel)
                 </label>
                 <div className="mt-1">
                   <textarea
                     id="description"
                     rows={3}
                     {...register('description')}
                     className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                   />
                   {errors.description && (
                     <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                   )}
                 </div>
              </div>
            </div>

            {/* Versions Field Array */}
            <div className="space-y-4 border-t pt-4 mt-6">
               <h4 className="text-md font-medium text-gray-800">Versions (Optionnel)</h4>
               {fields.map((field, index) => (
                 <div key={field.id} className="flex items-center space-x-2">
                    <input type="hidden" {...register(`versions.${index}.id` as const)} />
                    <Input
                      label={`Version ${index + 1}`}
                      placeholder="Nom de la version (ex: 11, 2.3)"
                      type="text"
                      {...register(`versions.${index}.version_name` as const)}
                      error={errors.versions?.[index]?.version_name?.message}
                      className="flex-grow shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-red-600 border border-red-500 hover:bg-red-50"
                      size="sm"
                      onClick={() => remove(index)}
                      aria-label={`Supprimer la version ${index + 1}`}
                     >
                      Supprimer
                    </Button>
                 </div>
               ))}
               <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => append({ version_name: '' })}
                >
                  Ajouter une version
               </Button>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 border-t pt-4 mt-6">
              {isEditing && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetForm}
                >
                  Annuler
                </Button>
              )}
              <Button
                type="submit"
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                {isEditing ? 'Mettre à jour' : 'Ajouter Compétence'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Skills List Card */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-gray-50">
           <h3 className="text-lg font-medium leading-6 text-gray-900">
             Liste des Compétences
           </h3>
        </div>
        <div className="border-t border-gray-200">
           {isLoading ? (
             <div className="text-center py-10 text-gray-500">Chargement...</div>
           ) : skillsWithDetails.length === 0 ? (
             <div className="text-center py-10 text-gray-500">Aucune compétence trouvée.</div>
           ) : (
            <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50">
                 <tr>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Famille</th>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Versions</th>
                   <th scope="col" className="relative px-6 py-3">
                     <span className="sr-only">Actions</span>
                   </th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {skillsWithDetails.map((skill) => (
                   <tr key={skill.id}>
                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{skill.name}</td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{skill.family_name}</td>
                     <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 max-w-xs truncate">{skill.description}</td>
                      <td className="px-6 py-4 whitespace-normal text-sm text-gray-500">
                         {skill.versions.length > 0 ? (
                            <ul className="list-disc list-inside">
                                {skill.versions.map(v => <li key={v.id}>{v.version_name}</li>)}
                            </ul>
                         ) : (
                            <span className="italic text-gray-400">Aucune</span>
                         )}
                      </td>
                     <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                       <Button
                         variant="secondary"
                         size="sm"
                         className="text-blue-600 hover:text-blue-800 p-1"
                         onClick={() => handleEdit(skill)}
                       >
                         Modifier
                       </Button>
                       <Button
                         variant="secondary"
                         size="sm"
                         className="text-red-600 hover:text-red-800 p-1"
                         onClick={() => handleDelete(skill)}
                       >
                         Supprimer
                       </Button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
             </div>
           )}
        </div>
      </div>
    </div>
  );
} 