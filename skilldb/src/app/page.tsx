'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto lg:flex lg:items-stretch lg:min-h-screen">
        <div className="lg:w-1/2 relative z-10 bg-white flex flex-col justify-center py-12 px-4 sm:px-6 md:py-16 lg:py-20 lg:px-8">
          <main className="w-full">
            <div className="sm:text-center lg:text-left">
              <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                <span className="block xl:inline">Valorisez vos</span>{' '}
                <span className="block text-blue-600 xl:inline">compétences</span>
              </h1>
              <p className="mt-4 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                SkillDB vous permet de répertorier et mettre en valeur vos compétences techniques, soft skills, langues et expériences professionnelles.
              </p>
              <div className="mt-6 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                {!loading && (
                  user ? (
                    <div className="rounded-md shadow">
                      <Link href="/profile">
                        <Button size="lg">Mon profil</Button>
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md shadow">
                        <Link href="/login">
                          <Button size="lg">Connexion</Button>
                        </Link>
                      </div>
                      <div className="mt-3 sm:mt-0 sm:ml-3">
                        <Link href="/register">
                          <Button size="lg" variant="secondary">Inscription</Button>
                        </Link>
                      </div>
                    </>
                  )
                )}
              </div>
            </div>
          </main>
        </div>
        <div className="lg:w-1/2 bg-blue-50 flex flex-col justify-center py-12 px-4 sm:px-6 md:py-16 lg:py-20 lg:px-8">
          <div className="text-center max-w-md mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Fonctionnalités</h2>
            <ul className="space-y-4 text-lg text-gray-700 text-left">
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Enregistrer vos compétences techniques et soft skills</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Ajouter vos certifications avec dates de validité</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Gérer votre profil linguistique</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Documenter votre expérience professionnelle</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 