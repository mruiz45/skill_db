'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Skill, User } from '@/types';

// Schéma du formulaire pour ajouter/éditer une compétence
const skillSchema = z.object({
  name: z.string().min(2, 'Le nom est requis'),
  type: z.enum(['hard', 'soft']),
  description: z.string().optional(),
});

type SkillFormValues = z.infer<typeof skillSchema>;

export default function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'skills' | 'users'>('skills');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Configuration du formulaire
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<SkillFormValues>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      name: '',
      type: 'hard',
      description: '',
    },
  });
  
  // Chargement des données
  useEffect(() => {
    if (!user || !isAdmin) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (activeTab === 'skills') {
          const { data, error } = await supabase
            .from('skills')
            .select('*')
            .order('name');
          
          if (error) throw error;
          setSkills(data as Skill[]);
        } else {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('fullName');
          
          if (error) throw error;
          setUsers(data as User[]);
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Une erreur est survenue lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [user, isAdmin, activeTab]);
  
  // Gérer la soumission du formulaire de compétence
  const onSubmitSkill = async (formData: SkillFormValues) => {
    if (!user || !isAdmin) return;
    
    setError(null);
    setSuccess(null);
    
    try {
      if (isEditing && selectedSkill) {
        // Mettre à jour une compétence existante
        const { error } = await supabase
          .from('skills')
          .update({
            name: formData.name,
            type: formData.type,
            description: formData.description,
          })
          .eq('id', selectedSkill.id);
        
        if (error) throw error;
        setSuccess('Compétence mise à jour avec succès');
      } else {
        // Ajouter une nouvelle compétence
        const { error } = await supabase
          .from('skills')
          .insert({
            name: formData.name,
            type: formData.type,
            description: formData.description,
          });
        
        if (error) throw error;
        setSuccess('Compétence ajoutée avec succès');
      }
      
      // Réinitialiser le formulaire et rafraîchir les données
      reset();
      setIsEditing(false);
      setSelectedSkill(null);
      
      // Recharger les compétences
      const { data: updatedSkills } = await supabase
        .from('skills')
        .select('*')
        .order('name');
      
      if (updatedSkills) {
        setSkills(updatedSkills as Skill[]);
      }
      
      // Masquer le message de succès après 3 secondes
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error managing skill:', err);
      setError(err.message || 'Une erreur est survenue');
    }
  };
  
  // Éditer une compétence
  const handleEditSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    setIsEditing(true);
    
    setValue('name', skill.name);
    setValue('type', skill.type as 'hard' | 'soft');
    setValue('description', skill.description || '');
  };
  
  // Supprimer une compétence
  const handleDeleteSkill = async (skill: Skill) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la compétence "${skill.name}" ?`)) return;
    
    try {
      setError(null);
      
      // Vérifier si la compétence est utilisée
      const { data: userSkills, error: checkError } = await supabase
        .from('user_skills')
        .select('id')
        .eq('skillId', skill.id);
      
      if (checkError) throw checkError;
      
      if (userSkills && userSkills.length > 0) {
        return setError(`Cette compétence ne peut pas être supprimée car elle est utilisée par ${userSkills.length} utilisateur(s).`);
      }
      
      // Supprimer la compétence
      const { error: deleteError } = await supabase
        .from('skills')
        .delete()
        .eq('id', skill.id);
      
      if (deleteError) throw deleteError;
      
      // Mettre à jour l'état local
      setSkills(skills.filter(s => s.id !== skill.id));
      setSuccess('Compétence supprimée avec succès');
      
      // Masquer le message de succès après 3 secondes
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error deleting skill:', err);
      setError(err.message || 'Une erreur est survenue lors de la suppression');
    }
  };
  
  // Annuler l'édition
  const cancelEdit = () => {
    setIsEditing(false);
    setSelectedSkill(null);
    reset();
  };
  
  // Modifier le rôle d'un utilisateur
  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (error) throw error;
      
      // Mettre à jour l'état local
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole as any } : u
      ));
      
      setSuccess('Rôle utilisateur mis à jour avec succès');
      
      // Masquer le message de succès après 3 secondes
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error changing user role:', err);
      setError(err.message || 'Une erreur est survenue lors de la mise à jour du rôle');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!user || !isAdmin) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Accès non autorisé</h2>
        <p className="mt-2 text-gray-600">Vous devez être administrateur pour accéder à cette page</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Administration</h1>
      
      {/* Onglets */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('skills')}
            className={`${
              activeTab === 'skills'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Gestion des compétences
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Gestion des utilisateurs
          </button>
        </nav>
      </div>
      
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
      
      {/* Gestion des compétences */}
      {activeTab === 'skills' && (
        <>
          {/* Formulaire d'ajout/édition de compétence */}
          <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
            <div className="px-4 py-5 sm:px-6 bg-gray-50">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {isEditing ? 'Modifier une compétence' : 'Ajouter une compétence'}
              </h3>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              <form onSubmit={handleSubmit(onSubmitSkill as any)} className="space-y-6">
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <Input 
                      label="Nom de la compétence" 
                      type="text" 
                      {...register('name')}
                      error={errors.name?.message}
                    />
                  </div>
                  
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Type de compétence
                    </label>
                    <select
                      {...register('type')}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="hard">Hard Skill (Technique)</option>
                      <option value="soft">Soft Skill</option>
                    </select>
                    {errors.type && (
                      <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
                    )}
                  </div>
                  
                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700">
                      Description (optionnelle)
                    </label>
                    <div className="mt-1">
                      <textarea
                        {...register('description')}
                        rows={3}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
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
                  <Button type="submit">
                    {isEditing ? 'Mettre à jour' : 'Ajouter'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
          
          {/* Liste des compétences */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 bg-gray-50">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Liste des compétences
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        Chargement...
                      </td>
                    </tr>
                  ) : skills.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        Aucune compétence trouvée
                      </td>
                    </tr>
                  ) : (
                    skills.map(skill => (
                      <tr key={skill.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {skill.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {skill.type === 'hard' ? 'Hard Skill' : 'Soft Skill'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {skill.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEditSkill(skill)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteSkill(skill)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      
      {/* Gestion des utilisateurs */}
      {activeTab === 'users' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Liste des utilisateurs
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inscrit le
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Chargement...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.fullName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <select
                          value={user.role}
                          onChange={(e) => changeUserRole(user.id, e.target.value)}
                          className="block w-full pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                          <option value="developer">Développeur</option>
                          <option value="devops">DevOps</option>
                          <option value="pm">Project Manager</option>
                          <option value="architect">Architecte</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a
                          href={`/admin/user/${user.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Voir détails
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 