import { AlertCircle } from 'lucide-react';
import { Alert, Container } from '@mantine/core';
import { getCourseService } from '@/lib/services/CourseService';
import { getCurrentUser } from '@/lib/supabase/server';
import { AdminCoursesClient } from './AdminCoursesClient';

export default async function CoursesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container size="md" py={48}>
        <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
          Please sign in to manage courses.
        </Alert>
      </Container>
    );
  }

  const service = getCourseService();
  const [universities, courses] = await Promise.all([
    service.getAllUniversities(),
    service.getAllCourses(),
  ]);

  const initialUniversities = universities.map((u) => ({
    id: u.id,
    name: u.name,
    shortName: u.shortName,
    logoUrl: u.logoUrl,
  }));

  const initialCourses = courses.map((c) => ({
    id: c.id,
    universityId: c.universityId,
    code: c.code,
    name: c.name,
  }));

  return (
    <AdminCoursesClient initialUniversities={initialUniversities} initialCourses={initialCourses} />
  );
}
