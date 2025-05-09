import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const templateFileName = 'CV_Template.docx';
  // Assuming the process runs from the workspace root ('c:/Development/SkillDB')
  // If the process runs from 'skilldb', the path should be path.join(process.cwd(), '..', templateFileName)
  // Corrected path: Go one level up from the current working directory (skilldb) to the workspace root
  const filePath = path.join(process.cwd(), '..', templateFileName);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found at path: ${filePath}`);
      return new NextResponse('Template file not found.', { status: 404 });
    }

    // Read the file content
    const fileBuffer = fs.readFileSync(filePath);

    // Create headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    headers.set('Content-Disposition', `attachment; filename="Generated_CV.docx"`);

    // Return the response
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: headers,
    });

  } catch (error) {
    console.error('Error reading or serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 