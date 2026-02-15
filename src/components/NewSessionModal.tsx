import { ArrowRight, Book, Building2, ChevronDown, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Center,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { MODES_METADATA } from '@/constants/modes';
import { useLanguage } from '@/i18n/LanguageContext';
import { COURSES, UNIVERSITIES } from '../constants/index';
import { PLACEHOLDERS } from '../constants/placeholders';
import { Course, TutoringMode } from '../types/index';

interface NewSessionModalProps {
  opened: boolean;
  onClose: () => void;
  onStart: (course: Course, mode: TutoringMode) => void | Promise<void>;
  preSelectedMode?: TutoringMode | null;
}

const MODE_LABEL_KEYS: Record<
  TutoringMode,
  'newLectureSession' | 'newAssignmentSession' | 'newMockExamSession'
> = {
  'Lecture Helper': 'newLectureSession',
  'Assignment Coach': 'newAssignmentSession',
  'Mock Exam': 'newMockExamSession',
};

const buttonShadowColors: Record<string, string> = {
  indigo: 'rgba(99, 102, 241, 0.25)',
  violet: 'rgba(139, 92, 246, 0.25)',
  purple: 'rgba(147, 51, 234, 0.25)',
};

const selectStyles = {
  input: {
    border: 'none',
    backgroundColor: 'transparent',
    padding: 0,
    paddingRight: '24px',
    height: 'auto',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--mantine-color-text)',
    width: '100%',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
  },
  wrapper: { width: '100%' },
  section: { display: 'none' },
  dropdown: {
    borderRadius: '12px',
    padding: '4px',
    border: '1px solid var(--mantine-color-default-border)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
};

const NewSessionModal: React.FC<NewSessionModalProps> = ({
  opened,
  onClose,
  onStart,
  preSelectedMode,
}) => {
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  React.useEffect(() => {
    const lastUni = localStorage.getItem('lastUniId');
    const lastCourse = localStorage.getItem('lastCourseId');
    if (lastUni) {
      setSelectedUniId(lastUni);
      if (lastCourse) {
        const courseExists = COURSES.some((c) => c.id === lastCourse && c.universityId === lastUni);
        if (courseExists) setSelectedCourseId(lastCourse);
      }
    }
  }, [preSelectedMode]);

  const filteredCourses = useMemo(() => {
    return COURSES.filter((c) => c.universityId === selectedUniId);
  }, [selectedUniId]);

  const handleStart = async () => {
    const course = COURSES.find((c) => c.id === selectedCourseId);
    if (course && preSelectedMode) {
      setIsLoading(true);
      try {
        localStorage.setItem('lastUniId', course.universityId);
        localStorage.setItem('lastCourseId', course.id);
        await onStart(course, preSelectedMode);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const activeThemeColor = useMemo(() => {
    if (!preSelectedMode) return 'indigo';
    return MODES_METADATA[preSelectedMode]?.color || 'indigo';
  }, [preSelectedMode]);

  const modalTitle = preSelectedMode
    ? t.modals[MODE_LABEL_KEYS[preSelectedMode]]
    : t.modals.newSession;

  const FormRow = ({
    icon: Icon,
    label,
    color,
    children,
    active,
  }: {
    icon: React.ElementType;
    label: string;
    color: string;
    children: React.ReactNode;
    active: boolean;
  }) => (
    <Box
      style={{
        borderRadius: '16px',
        border: active
          ? `1.5px solid var(--mantine-color-${color}-light-hover)`
          : '1.5px solid transparent',
        backgroundColor: active
          ? 'var(--mantine-color-body)'
          : 'var(--mantine-color-default-hover)',
        boxShadow: 'none',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Group gap={0} wrap="nowrap" align="stretch" w="100%" h="100%">
        <Center
          w={60}
          style={{ borderRight: active ? `1px solid var(--mantine-color-default-border)` : 'none' }}
        >
          <ThemeIcon
            variant={active ? 'light' : 'transparent'}
            color={active ? color : 'gray'}
            size={32}
            radius="lg"
          >
            <Icon size={18} strokeWidth={2} />
          </ThemeIcon>
        </Center>

        <Box
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
          px="md"
        >
          <Text
            size="10px"
            fw={700}
            tt="uppercase"
            lts={1}
            c={active ? `${color}.7` : 'gray.5'}
            mb={0}
          >
            {label}
          </Text>
          <Box style={{ position: 'relative', width: '100%' }}>
            {children}
            <Box
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--mantine-color-gray-4)',
              }}
            >
              <ChevronDown size={14} strokeWidth={2} />
            </Box>
          </Box>
        </Box>
      </Group>
    </Box>
  );

  const isFormValid = preSelectedMode && selectedCourseId;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      radius={24}
      centered
      padding={32}
      size="500px"
      overlayProps={{ backgroundOpacity: 0.3, blur: 8, color: '#1a1b1e' }}
      transitionProps={{ transition: 'pop', duration: 200, timingFunction: 'ease' }}
      styles={{
        content: {
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.1)',
          border: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-body)',
        },
      }}
    >
      <Stack gap={24}>
        <Group justify="space-between" align="center" mb={2}>
          <Text fw={800} size="22px" lts={-0.2}>
            {modalTitle}
          </Text>
          <UnstyledButton
            onClick={onClose}
            w={36}
            h={36}
            className="flex items-center justify-center rounded-full sidebar-hover"
          >
            <X size={18} strokeWidth={3} color="var(--mantine-color-gray-4)" />
          </UnstyledButton>
        </Group>

        <Stack gap={12}>
          <FormRow
            icon={Building2}
            label={t.modals.institution}
            color={activeThemeColor}
            active={true}
          >
            <Select
              data={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
              value={selectedUniId}
              onChange={(val) => {
                setSelectedUniId(val);
                setSelectedCourseId(null);
              }}
              placeholder={PLACEHOLDERS.SELECT_UNIVERSITY}
              variant="unstyled"
              styles={selectStyles}
              allowDeselect={false}
              searchable
            />
          </FormRow>

          <FormRow
            icon={Book}
            label={t.modals.targetSubject}
            color={activeThemeColor}
            active={!!selectedUniId}
          >
            <Select
              data={filteredCourses.map((c) => ({ value: c.id, label: `${c.code}: ${c.name}` }))}
              value={selectedCourseId}
              onChange={(val) => setSelectedCourseId(val)}
              placeholder={selectedUniId ? PLACEHOLDERS.SELECT_COURSE : PLACEHOLDERS.SELECT_FIRST}
              variant="unstyled"
              styles={selectStyles}
              disabled={!selectedUniId}
              allowDeselect={false}
              searchable
            />
          </FormRow>
        </Stack>

        <Button
          fullWidth
          size="lg"
          radius="xl"
          h={56}
          onClick={handleStart}
          disabled={!isFormValid || isLoading}
          loading={isLoading}
          variant="gradient"
          gradient={
            isFormValid
              ? { from: `${activeThemeColor}.5`, to: `${activeThemeColor}.6`, deg: 90 }
              : { from: 'gray.3', to: 'gray.4', deg: 90 }
          }
          styles={{
            root: {
              boxShadow: isFormValid
                ? `0 10px 20px -5px ${buttonShadowColors[activeThemeColor] || buttonShadowColors.indigo}`
                : 'none',
              transition: 'all 0.2s ease',
              border: 'none',
            },
            label: {
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            },
          }}
          rightSection={!isLoading && isFormValid && <ArrowRight size={18} strokeWidth={3} />}
        >
          {isLoading ? t.modals.initializing : t.modals.startSession}
        </Button>
      </Stack>
    </Modal>
  );
};

export default NewSessionModal;
