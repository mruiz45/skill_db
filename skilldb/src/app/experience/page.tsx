'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Experience, Skill } from '@/types';

const experienceSchema = z.object({
  company: z.string().min(1, 'Le nom de l\'entreprise est requis'),
  title: z.string().min(1, 'Le titre du poste est requis'),
  description: z.string().min(1, 'La description est requise'),
  startDate: z.string().min(1, 'La date de début est requise'),
  endDate: z.string().optional(),
  current: z.boolean(),
  relatedSkills: z.array(z.string()).optional(),
});

type ExperienceFormValues = z.infer<typeof experienceSchema>;

export default function ExperiencePage() {
  const { user, loading } = useAuth();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<{ id: string; name: string }[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  
  // Configuration du formulaire
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceSchema),
    defaultValues: {
      company: '',
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      current: false,
      relatedSkills: [],
    },
  });
  
  const isCurrent = watch('current');
  
  // Chargement des données
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Récupérer les expériences
        const { data: experienceData, error: experienceError } = await supabase
          .from('experiences')
          .select('*')
          .eq('userid', user.id)
          .order('startdate', { ascending: false });
        
        if (experienceError) throw experienceError;
        
        // Récupérer les compétences disponibles
        const { data: skillsData, error: skillsError } = await supabase
          .from('skills')
          .select('*')
          .order('name');
        
        if (skillsError) throw skillsError;
        
        // Map fetched data to Experience type
        const mappedExperiences = experienceData.map((exp: any) => ({
          ...exp,
          startDate: exp.startdate, // Map startdate to startDate
          endDate: exp.enddate,     // Map enddate to endDate
        }));

        setExperiences(mappedExperiences as Experience[]);
        setSkills(skillsData as Skill[]);
        
        // Formater les compétences pour le sélecteur
        const formattedSkills = skillsData.map((skill: Skill) => ({
          id: skill.id,
          name: `${skill.name} (${skill.type === 'hard' ? 'Technique' : 'Soft'})`,
        }));
        
        setAvailableSkills(formattedSkills);
      } catch (err: any) {
        console.error('Error fetching experiences:', err);
        setError('Une erreur est survenue lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [user]);
  
  // Gérer la soumission du formulaire
  const onSubmit = async (data: ExperienceFormValues) => {
    if (!user) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Préparer les données
      const experienceData = {
        company: data.company,
        title: data.title,
        description: data.description,
        startdate: data.startDate,
        enddate: data.current ? null : data.endDate,
        current: data.current,
        userid: user.id,
      };
      
      if (isEditing && selectedExperience) {
        // Mettre à jour une expérience existante
        const { error: updateError } = await supabase
          .from('experiences')
          .update(experienceData)
          .eq('id', selectedExperience.id);
        
        if (updateError) throw updateError;
        
        // Supprimer les anciennes relations avec les compétences
        await supabase
          .from('experience_skills')
          .delete()
          .eq('experienceid', selectedExperience.id);
        
        // Ajouter les nouvelles relations
        if (selectedSkills.length > 0) {
          const skillRelations = selectedSkills.map(skillId => ({
            experienceid: selectedExperience.id,
            skillid: skillId,
          }));
          
          const { error: skillsError } = await supabase
            .from('experience_skills')
            .insert(skillRelations);
          
          if (skillsError) throw skillsError;
        }
        
        setSuccess('Expérience mise à jour avec succès');
      } else {
        // Ajouter une nouvelle expérience
        const { data: newExperience, error: insertError } = await supabase
          .from('experiences')
          .insert(experienceData)
          .select();
        
        if (insertError) throw insertError;
        
        // Ajouter les relations avec les compétences
        if (selectedSkills.length > 0 && newExperience) {
          const skillRelations = selectedSkills.map(skillId => ({
            experienceid: newExperience[0].id,
            skillid: skillId,
          }));
          
          const { error: skillsError } = await supabase
            .from('experience_skills')
            .insert(skillRelations);
          
          if (skillsError) throw skillsError;
        }
        
        setSuccess('Expérience ajoutée avec succès');
      }
      
      // Réinitialiser le formulaire et les états
      reset();
      setIsEditing(false);
      setSelectedExperience(null);
      setSelectedSkills([]);
      
      // Recharger les expériences
      const { data: refreshedData } = await supabase
        .from('experiences')
        .select('*')
        .eq('userid', user.id)
        .order('startdate', { ascending: false });
      
      if (refreshedData) {
        // Map refreshed data to Experience type
        const mappedRefreshedExperiences = refreshedData.map((exp: any) => ({
          ...exp,
          startDate: exp.startdate, // Map startdate to startDate
          endDate: exp.enddate,     // Map enddate to endDate
        }));
        setExperiences(mappedRefreshedExperiences as Experience[]);
      }
      
      // Masquer le message de succès après 3 secondes
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error managing experience:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Éditer une expérience
  const handleEdit = async (experience: Experience) => {
    setSelectedExperience(experience);
    setIsEditing(true);
    
    // Récupérer les compétences associées
    const { data: experienceSkills, error } = await supabase
      .from('experience_skills')
      .select('skillid')
      .eq('experienceid', experience.id);
    
    if (!error && experienceSkills) {
      const skillIds = experienceSkills.map(es => es.skillid);
      setSelectedSkills(skillIds);
    }
    
    // Mettre à jour le formulaire
    setValue('company', experience.company);
    setValue('title', experience.title);
    setValue('description', experience.description);
    setValue('startDate', experience.startDate.substring(0, 10)); // Format YYYY-MM-DD
    setValue('current', experience.current);
    setValue('endDate', experience.endDate ? experience.endDate.substring(0, 10) : '');
  };
  
  // Supprimer une expérience
  const handleDelete = async (experience: Experience) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer cette expérience chez ${experience.company} ?`)) return;
    
    try {
      setError(null);
      
      // Supprimer les relations avec les compétences
      await supabase
        .from('experience_skills')
        .delete()
        .eq('experienceid', experience.id);
      
      // Supprimer l'expérience
      const { error: deleteError } = await supabase
        .from('experiences')
        .delete()
        .eq('id', experience.id);
      
      if (deleteError) throw deleteError;
      
      // Mettre à jour l'état local
      setExperiences(experiences.filter(e => e.id !== experience.id));
      setSuccess('Expérience supprimée avec succès');
      
      // Masquer le message de succès après 3 secondes
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error deleting experience:', err);
      setError(err.message || 'Une erreur est survenue lors de la suppression');
    }
  };
  
  // Annuler l'édition
  const cancelEdit = () => {
    setIsEditing(false);
    setSelectedExperience(null);
    setSelectedSkills([]);
    reset();
  };
  
  // Gérer la sélection des compétences
  const handleSkillChange = (skillId: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
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
        <p className="mt-2 text-gray-600">Veuillez vous connecter pour gérer vos expériences professionnelles</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Expérience Professionnelle</h1>
      
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {success}
        </div>
      )}
      
      {/* Formulaire d'ajout/édition d'expérience */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
        <div className="px-4 py-5 sm:px-6 bg-gray-50">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {isEditing ? 'Modifier une expérience' : 'Ajouter une expérience'}
          </h3>
        </div>
        
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <Input 
                  label="Entreprise" 
                  type="text" 
                  {...register('company')}
                  error={errors.company?.message}
                />
              </div>
              
              <div className="sm:col-span-3">
                <Input 
                  label="Poste occupé" 
                  type="text" 
                  {...register('title')}
                  error={errors.title?.message}
                />
              </div>
              
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700">
                  Description des responsabilités
                </label>
                <div className="mt-1">
                  <textarea
                    {...register('description')}
                    rows={4}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>
              </div>
              
              <div className="sm:col-span-2">
                <Input 
                  label="Date de début" 
                  type="date" 
                  {...register('startDate')}
                  error={errors.startDate?.message}
                />
              </div>
              
              <div className="sm:col-span-2">
                <div className="flex items-center h-5 mt-8">
                  <input
                    id="current"
                    type="checkbox"
                    {...register('current')}
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="current" className="ml-2 block text-sm text-gray-700">
                    Poste actuel
                  </label>
                </div>
              </div>

              {/* Empty column to fill grid space */}
              <div className="sm:col-span-2"></div>
              
              {!isCurrent && (
                <div className="sm:col-span-2">
                  <Input 
                    label="Date de fin" 
                    type="date" 
                    {...register('endDate')}
                    error={errors.endDate?.message}
                  />
                </div>
              )}

              {/* Add empty columns if endDate is not shown to maintain layout? Maybe not needed? Test first */}
              
              <div className="sm:col-span-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compétences associées
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {availableSkills.map(skill => (
                    <div key={skill.id} className="flex items-center">
                      <input
                        id={`skill-${skill.id}`}
                        type="checkbox"
                        checked={selectedSkills.includes(skill.id)}
                        onChange={() => handleSkillChange(skill.id)}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <label htmlFor={`skill-${skill.id}`} className="ml-2 block text-sm text-gray-700">
                        {skill.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              {isEditing && (
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={cancelEdit}
                >
                  Annuler
                </Button>
              )}
              <Button 
                type="submit" 
                isLoading={isSubmitting}
              >
                {isEditing ? 'Mettre à jour' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Liste des expériences */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-600">Chargement de vos expériences...</p>
          </div>
        ) : experiences.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <p className="text-gray-500">Vous n'avez pas encore ajouté d'expérience professionnelle.</p>
          </div>
        ) : (
          experiences.map(experience => (
            <div key={experience.id} className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-gray-50 flex justify-between items-center">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {experience.title} chez {experience.company}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(experience)}
                    className="text-sm text-blue-600 hover:text-blue-900"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(experience)}
                    className="text-sm text-red-600 hover:text-red-900"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-500">Période: </span>
                  <span className="text-sm text-gray-900">
                    {new Date(experience.startDate).toLocaleDateString()} - 
                    {experience.current 
                      ? ' Aujourd\'hui' 
                      : experience.endDate
                        ? ` ${new Date(experience.endDate).toLocaleDateString()}`
                        : ' Non spécifiée'
                    }
                  </span>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-700 whitespace-pre-line">{experience.description}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Compétences associées:</h4>
                  <div className="flex flex-wrap gap-2">
                    {/* Normalement, il faudrait charger les compétences associées à chaque expérience */}
                    {/* Pour simplifier, on affiche un message */}
                    <span className="text-sm text-gray-500">
                      Voir le détail sur la page de modification
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 