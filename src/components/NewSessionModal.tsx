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
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { MODES_LIST } from '@/constants/modes';
import { COURSES, UNIVERSITIES } from '../constants/index';
import { PLACEHOLDERS } from '../constants/placeholders';
import { Course, TutoringMode } from '../types/index';

interface NewSessionModalProps {
  opened: boolean;
  onClose: () => void;
  onStart: (course: Course, mode: TutoringMode) => void | Promise<void>;
  preSelectedMode?: TutoringMode | null;
}

const buttonShadowColors: Record<string, string> = {
  indigo: 'rgba(99, 102, 241, 0.25)',
  violet: 'rgba(139, 92, 246, 0.25)',
  purple: 'rgba(168, 85, 247, 0.25)',
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
    color: 'var(--mantine-color-dark-9)',
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
    border: '1px solid #e9ecef',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
};

const NewSessionModal: React.FC<NewSessionModalProps> = ({
  opened,
  onClose,
  onStart,
  preSelectedMode,
}) => {
  const [selectedMode, setSelectedMode] = useState<TutoringMode | null>(preSelectedMode || null);
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  React.useEffect(() => {
    if (opened && preSelectedMode) {
      setSelectedMode(preSelectedMode);
    }
  }, [opened, preSelectedMode]);

  const filteredCourses = useMemo(() => {
    return COURSES.filter((c) => c.universityId === selectedUniId);
  }, [selectedUniId]);

  const handleStart = async () => {
    const course = COURSES.find((c) => c.id === selectedCourseId);
    if (course && selectedMode) {
      setIsLoading(true);
      try {
        localStorage.setItem('lastUniId', course.universityId);
        localStorage.setItem('lastCourseId', course.id);
        await onStart(course, selectedMode);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const activeThemeColor = useMemo(() => {
    if (!selectedMode) return 'indigo';
    const mode = MODES_LIST.find((m) => m.label === selectedMode);
    return mode?.color || 'indigo';
  }, [selectedMode]);

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
        border: active ? `1.5px solid var(--mantine-color-${color}-3)` : '1.5px solid transparent',
        backgroundColor: active ? 'white' : 'var(--mantine-color-gray-0)',
        boxShadow: active ? `0 0 0 2px var(--mantine-color-${color}-0)` : 'none',
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
          style={{ borderRight: active ? `1px solid var(--mantine-color-gray-1)` : 'none' }}
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

  const isFormValid = selectedMode && selectedCourseId;

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
          border: '1px solid rgba(255,255,255,1)',
          background: 'white',
        },
      }}
    >
      <Stack gap={24}>
        <Group justify="space-between" align="center" mb={2}>
          <Text fw={800} size="22px" lts={-0.2} c="dark.9">
            Smart Setup
          </Text>
          <UnstyledButton
            onClick={onClose}
            w={36}
            h={36}
            className="flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={18} strokeWidth={3} className="text-gray-300" />
          </UnstyledButton>
        </Group>

        <Stack gap={12}>
          <FormRow icon={Building2} label="Institution" color={activeThemeColor} active={true}>
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
            label="Target Subject"
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

        <Box>
          <Group gap={8}>
            {MODES_LIST.map((mode, index) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.label;
              return (
                <Tooltip
                  key={mode.id}
                  label={mode.intro.replace(/\*\*(.*?)\*\*\n\n/, '')}
                  position="top"
                  withArrow
                  transitionProps={{ duration: 200, transition: 'pop-bottom-left' }}
                  multiline
                  w={220}
                  radius="md"
                  p="sm"
                  color="dark"
                  styles={{
                    tooltip: {
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      fontSize: '12px',
                      lineHeight: 1.4,
                    },
                  }}
                >
                  <UnstyledButton
                    onClick={() => setSelectedMode(mode.label)}
                    className="animate-fade-in-up"
                    style={{
                      flex: 1,
                      padding: '16px 8px',
                      borderRadius: '16px',
                      border: isSelected
                        ? `2px solid var(--mantine-color-${mode.color}-3)`
                        : '2px solid var(--mantine-color-gray-2)',
                      backgroundColor: isSelected
                        ? `var(--mantine-color-${mode.color}-0)`
                        : 'white',
                      boxShadow: isSelected
                        ? `0 8px 20px -4px var(--mantine-color-${mode.color}-2)`
                        : '0 2px 4px rgba(0,0,0,0.03)',
                      transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      animationDelay: `${index * 100}ms`,
                      opacity: 0, // Start invisible for animation
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--mantine-color-gray-3)';
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 12px 24px -8px rgba(0,0,0,0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--mantine-color-gray-2)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.03)';
                      }
                    }}
                  >
                    <Stack gap={10} align="center" justify="center" h="100%">
                      <ThemeIcon
                        variant={isSelected ? 'white' : 'light'}
                        color={isSelected ? mode.color : 'gray'}
                        size={48}
                        radius="xl"
                        style={{
                          boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        <Icon size={24} strokeWidth={isSelected ? 2.5 : 1.5} />
                      </ThemeIcon>
                      <Stack gap={2} align="center">
                        <Text
                          size="13px"
                          fw={700}
                          c={isSelected ? `${mode.color}.8` : 'dark.3'}
                          ta="center"
                          style={{ transition: 'color 0.2s ease' }}
                        >
                          {mode.label}
                        </Text>
                        <Text
                          size="10px"
                          fw={500}
                          c={isSelected ? `${mode.color}.6` : 'dimmed'}
                          ta="center"
                          style={{ transition: 'color 0.2s ease' }}
                        >
                          {mode.desc}
                        </Text>
                      </Stack>
                    </Stack>
                  </UnstyledButton>
                </Tooltip>
              );
            })}
          </Group>
        </Box>

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
          {isLoading
            ? 'Initializing...'
            : selectedMode
              ? `Initialize ${selectedMode}`
              : 'Select a Learning Mode'}
        </Button>
      </Stack>
    </Modal>
  );
};

export default NewSessionModal;
