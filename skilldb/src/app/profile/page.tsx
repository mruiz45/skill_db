'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { User } from '@/types';

// Define schema for a single education entry
const educationEntrySchema = z.object({
  degree: z.string().min(1, "Le choix d'un diplôme est requis"),
  qualification: z.string().min(1, "La qualification est requise"),
  institutionName: z.string().min(1, "Le nom de l'établissement est requis"),
  graduationYear: z.string()
    .min(4, "L'année doit contenir 4 chiffres")
    .max(4, "L'année doit contenir 4 chiffres")
    .refine(val => {
      const yearNum = parseInt(val);
      return !isNaN(yearNum) && yearNum > 1900 && yearNum <= new Date().getFullYear() + 10; // Allow few years in future
    }, { message: "Veuillez entrer une année valide (ex: 2023)." }),
  id: z.string().optional() // Optional: for existing entries that might have an ID from DB
});

const belgianDegrees = [
  "", // For the default "Sélectionnez un diplôme" option
  "Bachelier",
  "Master",
  "Master de spécialisation",
  "Doctorat (PhD)",
  "Agrégation de l'enseignement secondaire inférieur (AESI)",
  "Agrégation de l'enseignement secondaire supérieur (AESS)",
  "Certificat d'aptitudes pédagogiques (CAP)",
  "Brevet de l'enseignement supérieur (BES)",
  "Autre"
];

const profileSchema = z.object({
  fullName: z.string().min(2, 'Le nom complet est requis'),
  role: z.enum(['developer', 'devops', 'pm', 'architect', 'admin']),
  phoneNumber: z.string()
    .optional()
    .refine(val => !val || /^\+?[\d\s-]{7,20}$/.test(val), {
      message: "Le numéro de téléphone doit être valide (ex: +32 X XX XX XX ou 0X XX XX XX XX)",
    }),
  address: z.string().optional(),
  // Replace single education fields with an array of education entries
  educations: z.array(educationEntrySchema).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// Extend User type if 'educations' field is not already present
interface UserWithEducation extends User {
  educations?: ProfileFormValues['educations'];
}

export default function ProfilePage() {
  const { user: authUser, loading } = useAuth();
  const user = authUser as UserWithEducation | null; // Cast user to include educations

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, control, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      role: (user?.role as 'developer' | 'devops' | 'pm' | 'architect' | 'admin') || 'developer',
      phoneNumber: user?.phoneNumber || '',
      address: user?.address || "Blarenberglaan 2, 2800 Mechelen",
      // Initialize educations with user data or one empty entry
      educations: user?.educations && user.educations.length > 0 
        ? user.educations.map(edu => ({ 
            degree: edu.degree || '', // ensure mapping from potential old structure or provide default
            qualification: edu.qualification || '', 
            institutionName: edu.institutionName || '', 
            graduationYear: edu.graduationYear || '' ,
            id: edu.id // Preserve ID if it exists
          }))
        : [{ degree: '', qualification: '', institutionName: '', graduationYear: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "educations"
  });

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    
    setIsUpdating(true);
    setUpdateSuccess(false);
    setError(null);
    
    try {
      const updatePayload: Partial<Omit<ProfileFormValues, 'educations'> & { phone_number?: string; educations?: any[] }> = {
        fullName: data.fullName,
        role: data.role,
        phone_number: data.phoneNumber,
        address: data.address,
        educations: data.educations ? data.educations.map(edu => ({
            degree: edu.degree,
            qualification: edu.qualification,
            institutionName: edu.institutionName,
            graduationYear: edu.graduationYear
        })) : [],
      };
      
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      setUpdateSuccess(true);
      
      // Attendez 3 secondes avant de masquer le message de succès
      setTimeout(() => {
        setUpdateSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Une erreur est survenue lors de la mise à jour du profil');
    } finally {
      setIsUpdating(false);
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
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          
          {updateSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
              Profil mis à jour avec succès !
            </div>
          )}
          
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <Input 
                  label="Email" 
                  type="email" 
                  value={user.email}
                  disabled
                />
              </div>
              
              <div className="sm:col-span-3">
                <Input 
                  label="Nom complet" 
                  type="text" 
                  {...register('fullName')}
                  error={errors.fullName?.message}
                />
              </div>
              
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">
                  Rôle
                </label>
                <select
                  {...register('role')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="developer">Développeur</option>
                  <option value="devops">DevOps Engineer</option>
                  <option value="pm">Project Manager</option>
                  <option value="architect">Architecte</option>
                  {user.role === 'admin' && <option value="admin">Administrateur</option>}
                </select>
                {errors.role && (
                  <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                )}
              </div>

              <div className="sm:col-span-3">
                <Input 
                  label="Numéro de téléphone" 
                  type="tel" 
                  placeholder="+32 XXX XX XX XX / 0XXX XX XX XX"
                  {...register('phoneNumber')}
                  error={errors.phoneNumber?.message}
                />
              </div>

              <div className="sm:col-span-6">
                <Input 
                  label="Adresse" 
                  type="text" 
                  {...register('address')}
                  error={errors.address?.message}
                />
              </div>
            </div>
            
            {/* Education Section - Modified for useFieldArray */}
            <div className="pt-6 mt-6 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    Éducation et Diplômes
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Ajoutez ici vos informations de formation.
                  </p>
                </div>
                <Button 
                  type="button" 
                  onClick={() => append({ degree: '', qualification: '', institutionName: '', graduationYear: '' })}
                  variant="secondary"
                  size="sm"
                >
                  Ajouter une formation
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="mt-6 p-4 border border-gray-200 rounded-md space-y-4 mb-4 relative">
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor={`educations.${index}.degree`} className="block text-sm font-medium text-gray-700">
                        {`Diplôme #${index + 1}`}
                      </label>
                      <select
                        id={`educations.${index}.degree`}
                        {...register(`educations.${index}.degree`)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm"
                      >
                        {belgianDegrees.map(degreeName => (
                          <option key={degreeName} value={degreeName}>
                            {degreeName === "" ? "Sélectionnez un diplôme" : degreeName}
                          </option>
                        ))}
                      </select>
                      {errors.educations?.[index]?.degree && (
                        <p className="mt-1 text-sm text-red-600">{errors.educations?.[index]?.degree?.message}</p>
                      )}
                    </div>
                    <div className="sm:col-span-3">
                      <Input 
                        label={`Qualification #${index + 1}`}
                        type="text" 
                        {...register(`educations.${index}.qualification`)}
                        error={errors.educations?.[index]?.qualification?.message}
                      />
                    </div>
                    
                    <div className="sm:col-span-3">
                      <Input 
                        label="Établissement"
                        type="text" 
                        {...register(`educations.${index}.institutionName`)}
                        error={errors.educations?.[index]?.institutionName?.message}
                      />
                    </div>
                    
                    <div className="sm:col-span-3">
                      <Input 
                        label="Année d'obtention"
                        type="text"
                        placeholder="YYYY"
                        {...register(`educations.${index}.graduationYear`)}
                        error={errors.educations?.[index]?.graduationYear?.message}
                      />
                    </div>
                  </div>
                  {fields.length > 1 && (
                    <Button 
                      type="button" 
                      onClick={() => remove(index)}
                      variant="danger"
                      size="sm"
                      className="absolute top-2 right-2"
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {/* End of Education Section */}

            <div className="pt-5 text-right">
              <Button
                type="submit"
                isLoading={isUpdating}
              >
                Mettre à jour le profil
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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