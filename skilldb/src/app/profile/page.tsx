'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { User } from '@/types';
import { fetchMetadata, MetadataOption } from '@/lib/metadata';

// Define schema for a single education entry (maps to 'diplomas' table)
const educationEntrySchema = z.object({
  degree: z.string().min(1, "Le choix d'un diplôme est requis"),
  qualification: z.string().min(1, "La qualification est requise"),
  institution_name: z.string().min(1, "Le nom de l'établissement est requis"), // Ensures schema matches DB
  graduation_year: z.string() // Ensures schema matches DB
    .min(4, "L'année doit contenir 4 chiffres")
    .max(4, "L'année doit contenir 4 chiffres")
    .refine(val => {
      const yearNum = parseInt(val);
      return !isNaN(yearNum) && yearNum > 1900 && yearNum <= new Date().getFullYear() + 10;
    }, { message: "Veuillez entrer une année valide (ex: 2023)." }),
  id: z.string().uuid().optional(), // From 'diplomas' table
  user_id: z.string().uuid().optional(), // To associate with the user
});

// Profile schema without educations
const profileSchema = z.object({
  fullName: z.string().min(2, 'Le nom complet est requis'),
  role: z.enum(['developer', 'devops', 'pm', 'architect', 'admin']),
  phoneNumber: z.string()
    .optional()
    .refine(val => !val || /^\+?[\d\s-]{7,20}$/.test(val), {
      message: "Le numéro de téléphone doit être valide (ex: +32 X XX XX XX ou 0X XX XX XX XX)",
    }),
  address: z.string().optional(),
  // educations field removed from here
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type EducationEntryFormValues = z.infer<typeof educationEntrySchema>;

// User type might not need UserWithEducation if we always fetch diplomas separately
// interface UserWithEducation extends User {
//   educations?: EducationEntryFormValues[]; // Or a type matching diploma table structure
// }

export default function ProfilePage() {
  const { user: authUser, loading } = useAuth();
  // const user = authUser as UserWithEducation | null; // Adjust if UserWithEducation is removed
  const user = authUser; // Simpler user type now

  const [isProfileUpdating, setIsProfileUpdating] = useState(false); // Renamed from isUpdating
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false); // Renamed
  const [profileError, setProfileError] = useState<string | null>(null); // Renamed
  
  const [educationOpSuccess, setEducationOpSuccess] = useState<string | null>(null);
  const [educationOpError, setEducationOpError] = useState<string | null>(null);


  const [degreeOptions, setDegreeOptions] = useState<MetadataOption[]>([]);
  
  // State for managing the list of diplomas displayed on the client
  const [displayedDiplomas, setDisplayedDiplomas] = useState<EducationEntryFormValues[]>([]);

  const [showEducationForm, setShowEducationForm] = useState(false);
  const [editingEducationIdx, setEditingEducationIdx] = useState<number | null>(null); // Index in the 'fields' array
  const [editingDiplomaId, setEditingDiplomaId] = useState<string | null>(null); // Actual ID from DB

  const { register: registerProfile, handleSubmit: handleSubmitProfile, control: controlProfile, formState: { errors: profileErrors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      role: (user?.role as 'developer' | 'devops' | 'pm' | 'architect' | 'admin') || 'developer',
      phoneNumber: user?.phoneNumber || '',
      address: user?.address || "Blarenberglaan 2, 2800 Mechelen",
    },
  });
  
  // Removed useFieldArray hook that was tied to controlProfile
  
  // Form for the education inline sub-form
  const educationInlineFormMethods = useForm<EducationEntryFormValues>({
    resolver: zodResolver(educationEntrySchema),
    defaultValues: {
      degree: '',
      qualification: '',
      institution_name: '',
      graduation_year: '',
      id: undefined,
      user_id: user?.id
    }
  });
  const { 
    register: registerEducation, 
    handleSubmit: handleSubmitEducation, 
    formState: { errors: educationErrors, isSubmitting: isEducationSubmitting }, 
    reset: resetEducationForm,
    setValue: setEducationValue, // Added setValue
    control: controlEducation 
  } = educationInlineFormMethods;

  // Effect to fetch degrees metadata and existing diplomas
  useEffect(() => {
    fetchMetadata('degrees').then(setDegreeOptions);

    if (user?.id) {
      const fetchDiplomas = async () => {
        const { data, error } = await supabase
          .from('diplomas')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching diplomas:', error);
          setEducationOpError('Erreur lors du chargement des diplômes.');
        } else {
          const mappedData = data.map(d => ({...d, id: d.id, user_id: d.user_id, degree: d.degree, qualification: d.qualification, institution_name: d.institution_name, graduation_year: d.graduation_year })) as EducationEntryFormValues[];
          setDisplayedDiplomas(mappedData); // Populate state with fetched diplomas
        }
      };
      fetchDiplomas();
      setEducationValue('user_id', user.id);
    } else {
        setDisplayedDiplomas([]); // Clear diplomas if no user
    }
  }, [user, setEducationValue]); // Removed replace from dependencies as it's no longer from useFieldArray


  const handleAddNewEducationClick = () => {
    resetEducationForm({ degree: '', qualification: '', institution_name: '', graduation_year: '', id: undefined, user_id: user?.id });
    setEditingEducationIdx(null);
    setEditingDiplomaId(null);
    setShowEducationForm(true);
    setEducationOpSuccess(null);
    setEducationOpError(null);
  };

  const handleEditEducationClick = (index: number) => {
    const diplomaToEdit = displayedDiplomas[index]; // Get from state
    if (diplomaToEdit && diplomaToEdit.id) {
        resetEducationForm({
          degree: diplomaToEdit.degree,
          qualification: diplomaToEdit.qualification,
          institution_name: diplomaToEdit.institution_name,
          graduation_year: diplomaToEdit.graduation_year,
          id: diplomaToEdit.id,
          user_id: diplomaToEdit.user_id || user?.id
        });
        setEditingEducationIdx(index);
        setEditingDiplomaId(diplomaToEdit.id);
        setShowEducationForm(true);
        setEducationOpSuccess(null);
        setEducationOpError(null);
    }
  };

  const handleCancelEducationForm = () => {
    setShowEducationForm(false);
    setEditingEducationIdx(null);
    setEditingDiplomaId(null);
    resetEducationForm({ degree: '', qualification: '', institution_name: '', graduation_year: '', id: undefined, user_id: user?.id });
    setEducationOpSuccess(null);
    setEducationOpError(null);
  };

  // SAVING/UPDATING an education entry
  const onSaveEducationEntry = async (data: EducationEntryFormValues) => {
    if (!user?.id) {
      setEducationOpError("Utilisateur non identifié.");
      return;
    }
    setEducationOpSuccess(null);
    setEducationOpError(null);

    // Corrected and simplified diplomaPayload structure
    const diplomaPayload = {
      user_id: user.id,
      degree: data.degree,
      qualification: data.qualification,
      institution_name: data.institution_name, // Directly from form data, matching schema
      graduation_year: data.graduation_year, // Directly from form data, matching schema
    };

    if (editingDiplomaId && editingEducationIdx !== null) { // UPDATE existing diploma
      const { data: updatedData, error: updateError } = await supabase
        .from('diplomas')
        .update(diplomaPayload)
        .eq('id', editingDiplomaId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating diploma:', updateError);
        setEducationOpError('Erreur lors de la mise à jour du diplôme.');
      } else if (updatedData) {
        const newDisplayedDiplomas = [...displayedDiplomas];
        newDisplayedDiplomas[editingEducationIdx] = { 
            ...updatedData, 
            // No mapping needed if schema and DB are aligned (institution_name, graduation_year)
        } as EducationEntryFormValues;
        setDisplayedDiplomas(newDisplayedDiplomas);
        setEducationOpSuccess('Diplôme mis à jour avec succès !');
        setShowEducationForm(false);
        setEditingEducationIdx(null);
        setEditingDiplomaId(null);
      }
    } else { // CREATE new diploma
      const { data: insertedData, error: insertError } = await supabase
        .from('diplomas')
        .insert(diplomaPayload)
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting diploma:', insertError);
        setEducationOpError('Erreur lors de l\'ajout du diplôme.');
      } else if (insertedData) {
        // Add the new diploma to the displayed list
        setDisplayedDiplomas(prevDiplomas => [...prevDiplomas, 
            { 
                ...insertedData, 
                // No mapping needed if schema and DB are aligned
            } as EducationEntryFormValues]);
        setEducationOpSuccess('Diplôme ajouté avec succès !');
        setShowEducationForm(false);
      }
    }
    resetEducationForm({ degree: '', qualification: '', institution_name: '', graduation_year: '', id: undefined, user_id: user?.id });
    setTimeout(() => { setEducationOpSuccess(null); setEducationOpError(null); }, 3000);
  };
  
  // DELETING an education entry
  const handleDeleteEducation = async (diplomaId: string, index: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce diplôme ?")) return;
    setEducationOpSuccess(null);
    setEducationOpError(null);

    const { error: deleteError } = await supabase
      .from('diplomas')
      .delete()
      .eq('id', diplomaId);

    if (deleteError) {
      console.error('Error deleting diploma:', deleteError);
      setEducationOpError('Erreur lors de la suppression du diplôme.');
    } else {
      // Remove from displayed list
      setDisplayedDiplomas(prevDiplomas => prevDiplomas.filter((_, i) => i !== index));
      setEducationOpSuccess('Diplôme supprimé avec succès !');
    }
    setTimeout(() => { setEducationOpSuccess(null); setEducationOpError(null); }, 3000);
  };


  // Main profile form submission (only for user's own fields)
  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    
    setIsProfileUpdating(true);
    setProfileUpdateSuccess(false);
    setProfileError(null);
    
    try {
      // Payload no longer includes educations
      const updatePayload = {
        fullName: data.fullName,
        role: data.role,
        phone_number: data.phoneNumber,
        address: data.address,
      };
      
      const { error: updateError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      setProfileUpdateSuccess(true);
      setTimeout(() => setProfileUpdateSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setProfileError(err.message || 'Une erreur est survenue lors de la mise à jour du profil.');
    } finally {
      setIsProfileUpdating(false);
    }
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
        <p className="mt-2 text-gray-600">Veuillez vous connecter pour voir votre profil</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Mon Profil</h1>
      
      {/* Profile Information Form */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden mb-10">
        <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-gray-50 to-gray-100">
          <h3 className="text-lg font-medium leading-6 text-gray-800">
            Informations personnelles
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Vos informations de base
          </p>
        </div>
        
        <div className="px-4 py-5 sm:p-6">
          {profileError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {profileError}
            </div>
          )}
          {profileUpdateSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
              Profil mis à jour avec succès !
            </div>
          )}
          
          <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <Input 
                  label="Email" 
                  type="email" 
                  value={user.email || ''}
                  disabled
                />
              </div>
              
              <div className="sm:col-span-3">
                <Input 
                  label="Nom complet" 
                  type="text" 
                  {...registerProfile('fullName')}
                  error={profileErrors.fullName?.message}
                />
              </div>
              
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">
                  Rôle
                </label>
                <select
                  {...registerProfile('role')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="developer">Développeur</option>
                  <option value="devops">DevOps Engineer</option>
                  <option value="pm">Project Manager</option>
                  <option value="architect">Architecte</option>
                  {user.role === 'admin' && <option value="admin">Administrateur</option>}
                </select>
                {profileErrors.role && (
                  <p className="mt-1 text-sm text-red-600">{profileErrors.role.message}</p>
                )}
              </div>

              <div className="sm:col-span-3">
                <Input 
                  label="Numéro de téléphone" 
                  type="tel" 
                  placeholder="+32 XXX XX XX XX / 0XXX XX XX XX"
                  {...registerProfile('phoneNumber')}
                  error={profileErrors.phoneNumber?.message}
                />
              </div>

              <div className="sm:col-span-6">
                <Input 
                  label="Adresse" 
                  type="text" 
                  {...registerProfile('address')}
                  error={profileErrors.address?.message}
                />
              </div>
            </div>
            <div className="pt-5 text-right">
              <Button
                type="submit"
                isLoading={isProfileUpdating}
              >
                Mettre à jour le profil
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Education Section - Manages its own data via 'diplomas' table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden mb-10">
        <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-gray-50 to-gray-100">
          <h3 className="text-lg font-medium leading-6 text-gray-800">
            Éducation et Diplômes
          </h3>
           <p className="mt-1 text-sm text-gray-500">
            Gérez vos diplômes et formations. Chaque entrée est sauvegardée individuellement.
          </p>
        </div>
        <div className="px-4 py-5 sm:p-6">
            {educationOpError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                    {educationOpError}
                </div>
            )}
            {educationOpSuccess && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                    {educationOpSuccess}
                </div>
            )}

            {!showEducationForm && (
              <div className="text-right mb-4">
                <Button 
                    type="button" 
                    onClick={handleAddNewEducationClick}
                    variant="secondary"
                    size="sm"
                >
                    Ajouter une formation
                </Button>
              </div>
            )}

            {showEducationForm && (
            <div className="mt-6 p-4 border border-blue-200 rounded-md bg-blue-50 space-y-4 mb-6 shadow">
                <h4 className="text-md font-semibold text-gray-800 mb-3">
                {editingDiplomaId ? 'Modifier la formation' : 'Ajouter une nouvelle formation'}
                </h4>
                <form
                    onSubmit={(e) => { // Keep this form submission handling
                        e.preventDefault();
                        e.stopPropagation();
                        handleSubmitEducation(onSaveEducationEntry)();
                    }}
                    className="space-y-4"
                >
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                    <label htmlFor="eduDegreeInline" className="block text-sm font-medium text-gray-700">
                        Diplôme
                    </label>
                    <select
                        id="eduDegreeInline"
                        {...registerEducation('degree')}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm"
                    >
                        <option value="">Sélectionnez un diplôme</option>
                        {degreeOptions.map(option => (
                        <option key={option.item_key} value={option.item_key}>
                            {option.value}
                        </option>
                        ))}
                    </select>
                    {educationErrors.degree && (
                        <p className="mt-1 text-sm text-red-600">{educationErrors.degree.message}</p>
                    )}
                    </div>
                    <div className="sm:col-span-1">
                    <Input 
                        label="Qualification"
                        type="text" 
                        {...registerEducation('qualification')}
                        error={educationErrors.qualification?.message}
                    />
                    </div>
                    <div className="sm:col-span-1">
                    <Input 
                        label="Établissement"
                        type="text" 
                        {...registerEducation('institution_name')} // Register with 'institution_name'
                        error={educationErrors.institution_name?.message}
                    />
                    </div>
                    <div className="sm:col-span-1">
                    <Input 
                        label="Année d'obtention"
                        type="text"
                        placeholder="YYYY"
                        {...registerEducation('graduation_year')} // Register with 'graduation_year'
                        error={educationErrors.graduation_year?.message}
                    />
                    </div>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <Button type="button" variant="secondary" onClick={handleCancelEducationForm}>
                    Annuler
                    </Button>
                    <Button type="button" onClick={() => handleSubmitEducation(onSaveEducationEntry)()} isLoading={isEducationSubmitting}>
                    {editingDiplomaId ? 'Mettre à jour' : 'Enregistrer'}
                    </Button>
                </div>
                </form>
            </div>
            )}

            {/* Displaying the list of diplomas from state */}
            {displayedDiplomas.length === 0 && !showEducationForm && (
            <p className="text-sm text-gray-500 mt-4 text-center">Aucune formation ajoutée pour le moment.</p>
            )}

            <div className="space-y-3 mt-4">
            {displayedDiplomas.map((currentDiploma, index) => {
                return (
                    <div key={currentDiploma.id || index} className="p-4 border border-gray-200 rounded-md space-y-1 relative hover:shadow-md transition-shadow duration-150 bg-white">
                    <div className="absolute top-3 right-3 space-x-2">
                        <Button 
                        type="button" 
                        onClick={() => handleEditEducationClick(index)}
                        variant="secondary" 
                        size="sm"
                        className="text-blue-600 hover:text-blue-800 p-1 disabled:opacity-50"
                        disabled={showEducationForm && editingDiplomaId === currentDiploma.id}
                        >
                        Modifier
                        </Button>
                        <Button 
                        type="button" 
                        onClick={() => currentDiploma.id && handleDeleteEducation(currentDiploma.id, index)}
                        variant="danger"
                        size="sm"
                        className="text-red-600 hover:text-red-800 p-1 disabled:opacity-50"
                        disabled={showEducationForm || !currentDiploma.id}
                        >
                        Supprimer
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-md">
                        <span className="font-semibold text-blue-800">
                            {degreeOptions.find(d => d.item_key === currentDiploma.degree)?.value || currentDiploma.degree || 'Diplôme non spécifié'}
                        </span>
                        <span>·</span>
                        <span>{currentDiploma.qualification || 'Qualification non spécifiée'}</span>
                        <span>·</span>
                        <span>{currentDiploma.institution_name || 'Établissement non spécifié'}</span>
                        <span>·</span>
                        <span>Année: {currentDiploma.graduation_year || 'Non spécifiée'}</span>
                    </div>
                    </div>
                );
            })}
            </div>
        </div>
      </div>
      
      {/* Other sections like Skills, Experience, CV */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* ... (Skill, Soft skill, Experience, CV buttons) ... */}
        <div className="bg-white shadow-md rounded-lg p-6 flex flex-col h-full border border-gray-200 hover:shadow-lg transition-shadow duration-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Compétences techniques
          </h3>
          <p className="text-gray-600 text-sm mb-5">
            Gérez vos compétences techniques
          </p>
          <div className="mt-auto">
            <Button
              onClick={() => window.location.href = '/skills?type=hard'}
              variant="secondary"
              className="whitespace-normal text-center w-full"
            >
              Gérer mes compétences techniques
            </Button>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6 flex flex-col h-full border border-gray-200 hover:shadow-lg transition-shadow duration-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Soft Skills
          </h3>
          <p className="text-gray-600 text-sm mb-5">
            Gérez vos soft skills
          </p>
          <div className="mt-auto">
            <Button
              onClick={() => window.location.href = '/skills?type=soft'}
              variant="secondary"
              className="whitespace-normal text-center w-full"
            >
              Gérer mes soft skills
            </Button>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6 flex flex-col h-full border border-gray-200 hover:shadow-lg transition-shadow duration-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Expérience professionnelle
          </h3>
          <p className="text-gray-600 text-sm mb-5">
            Gérez votre expérience professionnelle
          </p>
          <div className="mt-auto">
            <Button
              onClick={() => window.location.href = '/experience'}
              variant="secondary"
              className="whitespace-normal text-center w-full"
            >
              Gérer mon expérience
            </Button>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6 flex flex-col h-full border border-gray-200 hover:shadow-lg transition-shadow duration-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            CV
          </h3>
          <p className="text-gray-600 text-sm mb-5">
            Gérez ou générez votre CV
          </p>
          <div className="mt-auto">
            <Button
              onClick={() => window.location.href = '/cv'}
              variant="secondary"
              className="whitespace-normal text-center w-full"
            >
              Gérer mon CV
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 