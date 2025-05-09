import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Optional: for LLM call (e.g., OpenAI)
// import OpenAI from 'openai';

// Force dynamic rendering to ensure cookies are read correctly
export const dynamic = 'force-dynamic';

// Helper function to calculate duration
function calculateDuration(startDateStr: string | null | undefined, endDateStr: string | null | undefined): string {
    if (!startDateStr) return "";
    const start = new Date(startDateStr);
    const end = endDateStr ? new Date(endDateStr) : new Date(); // now if no end date

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }

    let result = "";
    if (years > 0) result += `${years} an${years > 1 ? 's' : ''}`;
    if (months > 0) {
      if (result) result += " ";
      result += `${months} mois`;
    }
    return result.trim() || "Moins d'un mois";
}

// Helper function to calculate experience for a specific company
function calculateDurationForCompany(experiences: any[], companyName: string): string {
    const companyExperiences = experiences.filter(exp => exp.company && exp.company.toLowerCase() === companyName.toLowerCase());
    if (companyExperiences.length === 0) return "N/A";

    const allStartDates = companyExperiences.map(exp => new Date(exp.startdate));
    const allEndDates = companyExperiences.map(exp => exp.enddate ? new Date(exp.enddate) : new Date()); // now if current
    const minStartDate = new Date(Math.min.apply(null, allStartDates.map(d => d.getTime())));
    const maxEndDate = new Date(Math.max.apply(null, allEndDates.map(d => d.getTime())));
    return calculateDuration(minStartDate.toISOString(), maxEndDate.toISOString());
}


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    try {
        // Initialize Supabase client
        const cookieStore = cookies();
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        // --- A. Récupération des données ---
        console.log('Fetching user data for ID:', userId);
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('email, fullname, role, createdat, updatedat') // Ensure these columns exist
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            console.error('Error fetching user:', userError);
            return NextResponse.json({ error: 'User not found or error fetching user data.' }, { status: 404 });
        }
        console.log('User Data:', userData);

        console.log('Fetching experiences...');
        const { data: experiencesData, error: experiencesError } = await supabase
            .from('experiences')
            .select(`
                id, company, title, description, startdate, enddate, current,
                experience_skills (
                    skills (
                        id, name, type, description,
                        skill_families (id, name)
                    )
                )
            `)
            .eq('userid', userId)
            .order('startdate', { ascending: false }); // Plus récent en premier

        if (experiencesError) {
            console.error('Error fetching experiences:', experiencesError);
            throw experiencesError;
        }
        console.log('Experiences Data:', experiencesData);

        console.log('Fetching user skills & trainings...');
        const { data: userSkillsData, error: userSkillsError } = await supabase
            .from('user_skills')
            .select(`
                id, level, hascertification, certificationname, certificationdate, certificationexpiry,
                comment, hastrainings,
                skills (id, name, type, description, family_id),
                trainings (name, date, provider)
            `)
            .eq('userid', userId);

        if (userSkillsError) {
            console.error('Error fetching user skills:', userSkillsError);
            throw userSkillsError;
        }
        console.log('User Skills Data:', userSkillsData);

        console.log('Fetching certifications...');
        let certificationsData: any[] = [];
        let certError: any = null;

        if (userSkillsData && userSkillsData.length > 0) {
            const userSkillIds = userSkillsData.map((uskill: any) => uskill.id).filter(id => id != null);
            if (userSkillIds.length > 0) {
                const { data, error } = await supabase
                    .from('certifications')
                    .select('name, date, expiry_date, userskill_id') // Added userskill_id for potential further use
                    .in('userskill_id', userSkillIds);
                certificationsData = data || [];
                certError = error;
            } else {
                // No user_skills found, so no certifications can be linked this way
                certificationsData = [];
            }
        } else {
            // No user_skills found, so no certifications can be linked this way
            certificationsData = [];
        }

        if (certError) {
            console.error('Error fetching certifications:', certError);
            throw certError;
        }
        console.log('Certifications Data:', certificationsData);

        // --- B. Traitement des données ---
        const experiences = experiencesData || [];
        const certifications = certificationsData || [];
        const userSkills = userSkillsData || [];

        // 1. Role in company
        const role_in_company = experiences?.[0]?.title || 'N/A'; // Le plus récent

        // 2. Email ID & Fullname
        const email_id = userData.email;
        const fullname = userData.fullname;

        // 3. Total experience
        let total_experience = "N/A";
        if (experiences && experiences.length > 0) {
            const allStartDates = experiences.map(exp => new Date(exp.startdate).getTime());
            const allEndDates = experiences.map(exp => exp.enddate ? new Date(exp.enddate).getTime() : new Date().getTime());
            if (allStartDates.length > 0 && allStartDates.every(d => !isNaN(d))) { // check for valid dates
                const minStartDate = new Date(Math.min.apply(null, allStartDates));
                const maxEndDate = new Date(Math.max.apply(null, allEndDates));
                total_experience = calculateDuration(minStartDate.toISOString(), maxEndDate.toISOString());
            }
        }
        
        // 4. Experience summary (LLM) - Exemple simplifié
        let experience_summary_points = ["Summary généré par défaut."];
        // Construction du prompt pour le LLM
        // const llmPrompt = `Génère un résumé d'expérience concis en 3-4 points (commençant par '•') pour un CV basé sur ces informations:
        // Rôles: ${experiences.map(e => `${e.title} chez ${e.company} (${calculateDuration(e.startdate, e.enddate)}): ${e.description}`).join('; ')}.
        // Compétences clés: ${[...new Set(experiences.flatMap(exp => exp.experience_skills.map((es: any) => es.skills.name)))].join(', ')}.
        // Met l'accent sur les réalisations et l'expertise globale.`;

        // try {
        //     // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        //     // const response = await openai.chat.completions.create({
        //     //     model: "gpt-3.5-turbo", // ou gpt-4
        //     //     messages: [{ role: "user", content: llmPrompt }],
        //     // });
        //     // const summaryText = response.choices[0].message.content;
        //     // experience_summary_points = summaryText.split('•').map(s => s.trim()).filter(s => s);
        // } catch (llmError) {
        //     console.error("LLM Error:", llmError);
        //     experience_summary_points = ["Erreur lors de la génération du résumé d'expérience."];
        // }


        // 5. Domain expertise
        const domain_expertise_map = new Map<string, Map<string, string>>();
        experiences.forEach((exp: any) => {
            const expDuration = calculateDuration(exp.startdate, exp.enddate);
            exp.experience_skills?.forEach((es: any) => {
                if (es.skills && es.skills.skill_families) {
                    const domainName = es.skills.skill_families.name;
                    const skillName = es.skills.name;
                    if (!domain_expertise_map.has(domainName)) {
                        domain_expertise_map.set(domainName, new Map<string, string>());
                    }
                    domain_expertise_map.get(domainName)!.set(skillName, expDuration);
                }
            });
        });
        const domain_expertise_rows: { domain: string; specific_area: string; experience_yrs_months: string }[] = [];
        domain_expertise_map.forEach((skillsMap, domain) => {
            skillsMap.forEach((experience, specific_area) => {
                domain_expertise_rows.push({ domain, specific_area, experience_yrs_months: experience });
            });
        });

        // 6. Technical expertise (skills type = 'hard')
        const technical_expertise_primary_skills: { skill_name: string; experience_yrs_months: string }[] = [];
        experiences.forEach((exp: any) => {
            const expDuration = calculateDuration(exp.startdate, exp.enddate);
            exp.experience_skills?.forEach((es: any) => {
                if (es.skills && es.skills.type === 'hard') {
                    const existingSkill = technical_expertise_primary_skills.find(s => s.skill_name === es.skills.name);
                    if (!existingSkill) {
                        technical_expertise_primary_skills.push({
                            skill_name: es.skills.name,
                            experience_yrs_months: expDuration
                        });
                    }
                }
            });
        });

        // 7. Education background
        const education_background_rows: { degree_qualification: string; college_university: string; year_attained: string }[] = [
            /* { degree_qualification: '...', college_university: '...', year_attained: '...'} */
        ];

        // 8. Professional activities, certifications and trainings
        const professional_activities_rows: { course_certification_name: string; institution: string; year: string | number; years_of_experience: string }[] = [];
        certifications.forEach((cert: any) => {
            professional_activities_rows.push({
                course_certification_name: cert.name,
                institution: "N/A (Certification)",
                year: cert.date ? new Date(cert.date).getFullYear() : "N/A",
                years_of_experience: ""
            });
        });

        userSkills.forEach((uskill: any) => {
            if (uskill.hastrainings && uskill.trainings && Array.isArray(uskill.trainings)) {
                uskill.trainings.forEach((training: any) => {
                    professional_activities_rows.push({
                        course_certification_name: training.name,
                        institution: training.provider || "N/A",
                        year: training.date ? new Date(training.date).getFullYear() : "N/A",
                        years_of_experience: "" // This might need data if available
                    });
                });
            }
            if (uskill.hascertification) {
                const certName = uskill.certificationname || uskill.skills?.name || "Unnamed Certification";
                professional_activities_rows.push({
                    course_certification_name: certName,
                    institution: "N/A (via User Skill)", // Or derive if possible
                    year: uskill.certificationdate ? new Date(uskill.certificationdate).getFullYear() : "N/A",
                    years_of_experience: "" // This might need data if available
                });
            }
        });
        
        professional_activities_rows.sort((a, b) => {
            const yearA = typeof a.year === 'number' ? a.year : 0;
            const yearB = typeof b.year === 'number' ? b.year : 0;
            return yearB - yearA; // Sort descending by year
        });


        // 9. Employment history
        const employment_history_items = experiences.map((exp: any) => ({
            project_name: exp.title,
            client: exp.company,
            project_location: "Brussels, Belgium", // To make dynamic if necessary
            start_date: exp.startdate ? new Date(exp.startdate).toLocaleDateString('fr-FR') : "N/A",
            end_date: exp.enddate ? new Date(exp.enddate).toLocaleDateString('fr-FR') : "Présent",
            team_size: "...", // To add if you have this data
            project_description: exp.description,
            responsibilities: exp.description ? exp.description.split('\n').map((r: string) => ({ text: r.replace(/^- /, '') })) : [],
            other_contributions: [ /* { text: "..." } */ ]
        }));

        // --- C. Génération du DOCX ---
        const templatePath = path.resolve(process.cwd(), 'public', 'CV_Template.docx');
        console.log('Attempting to load template from:', templatePath);

        if (!fs.existsSync(templatePath)) {
            console.error(`Template file not found at path: ${templatePath}`);
            return NextResponse.json({ error: 'Template file not found.' }, { status: 404 });
        }
        const templateFile = fs.readFileSync(templatePath, 'binary');

        const zip = new PizZip(templateFile);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            // nullGetter: function(tag: any) {
            //     console.warn(`Placeholder not found: ${tag.value}`);
            //     return `[${tag.value} NOT FOUND]`;
            // }
        });

        const dataForTemplate = {
            fullname: fullname || "N/A",
            role_in_company,
            email_id: email_id || "N/A",
            total_experience,
            dxc_experience: calculateDurationForCompany(experiences, "DXC"), // Ensure "DXC" is the correct name
            experience_summary_points,
            domain_expertise_rows,
            technical_expertise_primary_skills,
            technical_expertise_secondary_skills: [], // To be filled if distinction exists
            education_background_rows,
            professional_activities_rows,
            employment_history_items,
            main_company: "DXC Technology", // Set to DXC Technology or make dynamic
            contact_no: "...", // To be filled
            location: "Company Address", // Or make dynamic
            last_updated: userData.updatedat ? new Date(userData.updatedat).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
        };

        console.log('Data for Template:', dataForTemplate);
        // doc.setData(dataForTemplate); // OLD WAY

        try {
            // doc.render(); // OLD WAY
            doc.render(dataForTemplate); // NEW WAY
        } catch (error: any) {
            console.error("Docxtemplater render error:", error);
            let errors = [{message: error.message}];
            if (error.properties && error.properties.errors) {
               errors = error.properties.errors.map((err: any) => ({
                 id: err.id,
                 message: err.message,
                 explanation: err.explanation,
                 stack: err.stack,
               }));
              console.error("Template Errors:", JSON.stringify(errors, null, 2));
            }
            return NextResponse.json({ error: "Failed to render CV document.", details: errors }, { status: 500 });
        }

        const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        const headers = new Headers();
        headers.set('Content-Disposition', `attachment; filename="cv_${(fullname || 'user').replace(/\s+/g, '_')}.docx"`);
        headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        return new NextResponse(buf, {
            status: 200,
            headers: headers,
        });

    } catch (error: any) {
        console.error('Error generating CV:', error);
        return NextResponse.json({ error: 'Failed to generate CV.', details: error.message }, { status: 500 });
    }
}