'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getUser } from '@/lib/supabase';
import { User } from '@/types';

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  error: Error | null;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  error: null,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabaseUser = await getUser();
        
        if (supabaseUser) {
          console.log('Supabase user found:', supabaseUser.id);
          
          // Récupérer les données utilisateur de notre table personnalisée
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', supabaseUser.id)
            .single();
            
          if (error) {
            console.error('Error retrieving user data:', error);
            throw error;
          }
          
          console.log('User data retrieved:', data);
          
          // Map database column names to our TypeScript model
          // This handles potential snake_case to camelCase conversion
          const mappedUserData: User = {
            id: data.id,
            email: data.email,
            // Try both naming conventions to accommodate database schema
            fullName: data.fullname || '',
            role: data.role,
            createdAt: data.created_at || data.createdAt,
            updatedAt: data.updated_at || data.updatedAt,
          };
          
          console.log('Mapped user data:', mappedUserData);
          
          setUser(mappedUserData);
          setIsAdmin(data.role === 'admin');
        }
      } catch (err) {
        console.error('Error in auth context:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    // S'abonner aux changements d'auth
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      if (session) {
        fetchUser();
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });

    fetchUser();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}; 