'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { signUpWithEmail, supabase } from '@/lib/supabase';

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string().min(6, 'La confirmation du mot de passe est requise'),
  fullName: z.string().min(2, 'Le nom complet est requis'),
  role: z.enum(['developer', 'devops', 'pm', 'architect']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      role: 'developer',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Inscription de l'utilisateur
      const authData = await signUpWithEmail(data.email, data.password, {
        fullname: data.fullName,
        role: data.role,
      });
      
      if (authData.user) {
        // Log user data to help diagnose issues
        console.log('Auth user data:', authData.user);
        
        // Créer l'entrée utilisateur dans la table users
        // Use the correct column name 'fullname'
        const userData = {
          id: authData.user.id,
          email: data.email,
          fullname: data.fullName,
          role: data.role,
        };
        
        console.log('Inserting user data:', userData);
        
        // Use upsert method with onConflict option
        const { error: userError } = await supabase
          .from('users')
          .upsert(userData, { 
            onConflict: 'id',
            ignoreDuplicates: false
          });
        
        if (userError) {
          console.error('Database insert error:', userError);
          throw userError;
        }
        
        console.log('User inserted successfully');
        router.push('/login?registered=true');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Une erreur est survenue lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col justify-center pb-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Créer un nouveau compte
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Ou{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            connectez-vous à votre compte
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <Input 
              label="Email" 
              type="email" 
              {...register('email')}
              error={errors.email?.message}
            />

            <Input 
              label="Mot de passe" 
              type="password" 
              {...register('password')}
              error={errors.password?.message}
            />

            <Input 
              label="Confirmer le mot de passe" 
              type="password" 
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
            />

            <Input 
              label="Nom complet" 
              type="text" 
              {...register('fullName')}
              error={errors.fullName?.message}
            />

            <div>
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
              </select>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>

            <div>
              <Button 
                type="submit" 
                fullWidth
                isLoading={isLoading}
              >
                S'inscrire
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 