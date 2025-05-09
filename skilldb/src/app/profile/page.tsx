'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { User } from '@/types';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Le nom complet est requis'),
  role: z.enum(['developer', 'devops', 'pm', 'architect', 'admin']),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      role: (user?.role as 'developer' | 'devops' | 'pm' | 'architect' | 'admin') || 'developer',
    },
    values: {
      fullName: user?.fullName || '',
      role: (user?.role as 'developer' | 'devops' | 'pm' | 'architect' | 'admin') || 'developer',
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    
    setIsUpdating(true);
    setUpdateSuccess(false);
    setError(null);
    
    try {
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({ 
          fullname: data.fullName,
          role: data.role 
        })
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
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
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
            </div>
            
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
      </div>
    </div>
  );
} 