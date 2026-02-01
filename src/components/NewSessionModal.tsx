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
import { COURSES, UNIVERSITIES } from '../constants/index';
import { Course, TutoringMode } from '../types/index';

interface NewSessionModalProps {
  opened: boolean;
  onClose: () => void;
  onStart: (course: Course, mode: TutoringMode | null) => void;
}

const NewSessionModal: React.FC<NewSessionModalProps> = ({ opened, onClose, onStart }) => {
  // 初始化为 null 以强制引导用户选择
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Load defaults from localStorage
  React.useEffect(() => {
    const lastUni = localStorage.getItem('lastUniId');
    const lastCourse = localStorage.getItem('lastCourseId');
    if (lastUni) {
      setSelectedUniId(lastUni);
      if (lastCourse) {
        // Verify the course belongs to the uni
        const courseExists = COURSES.some((c) => c.id === lastCourse && c.universityId === lastUni);
        if (courseExists) setSelectedCourseId(lastCourse);
      }
    }
  }, []);

  const filteredCourses = useMemo(() => {
    return COURSES.filter((c) => c.universityId === selectedUniId);
  }, [selectedUniId]);

  const handleStart = () => {
    const course = COURSES.find((c) => c.id === selectedCourseId);
    if (course) {
      // Save to localStorage
      localStorage.setItem('lastUniId', course.universityId);
      localStorage.setItem('lastCourseId', course.id);

      onStart(course, null); // Start with no mode
    }
  };

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
        border: active ? `1.5px solid var(--mantine-color-${color}-4)` : '1.5px solid transparent', // Thinner border
        backgroundColor: active ? 'white' : 'var(--mantine-color-gray-0)', // Slight distinction
        boxShadow: active ? `0 0 0 2px var(--mantine-color-${color}-1)` : 'none', // Softer shadow
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        height: '64px', // Compact height (was 84px)
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Group gap={0} wrap="nowrap" align="stretch" w="100%" h="100%">
        {/* Icon Section - Smaller */}
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

        {/* Content Section */}
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
            c={active ? `${color}.7` : 'gray.5'} // Color hint when active
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

  const selectStyles = {
    input: {
      border: 'none',
      backgroundColor: 'transparent',
      padding: 0,
      paddingRight: '24px',
      height: 'auto',
      fontSize: '15px', // Slightly smaller
      fontWeight: 600,
      color: 'var(--mantine-color-dark-9)',
      width: '100%',
      whiteSpace: 'nowrap',
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      radius={24}
      centered
      padding={32}
      size="500px" // Slightly narrower
      overlayProps={{ backgroundOpacity: 0.3, blur: 8, color: '#1a1b1e' }} // Lighter overlay
      transitionProps={{ transition: 'pop', duration: 200, timingFunction: 'ease' }}
      styles={{
        content: {
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.1)',
          border: '1px solid rgba(255,255,255,1)', // Clean white border
          background: 'white', // Pure white background, no gradient
        },
      }}
    >
      <Stack gap={24}>
        <Group justify="space-between" align="start" mb={2}>
          <Box>
            <Text
              fw={800}
              size="22px"
              lts={-0.2}
              c="dark.9" // Neutral color
              style={{ lineHeight: 1.2 }}
            >
              Smart Setup
            </Text>
            <Text size="sm" c="gray.5" fw={500} mt={4}>
              Configure your study session
            </Text>
          </Box>
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
          <FormRow icon={Building2} label="Institution" color="blue" active={true}>
            <Select
              data={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
              value={selectedUniId}
              onChange={(val) => {
                setSelectedUniId(val);
                setSelectedCourseId(null); // 学校变了，重置后续
              }}
              placeholder="Select University"
              variant="unstyled"
              styles={selectStyles}
              allowDeselect={false}
              searchable
            />
          </FormRow>

          <FormRow icon={Book} label="Target Subject" color="indigo" active={!!selectedUniId}>
            <Select
              data={filteredCourses.map((c) => ({ value: c.id, label: `${c.code}: ${c.name}` }))}
              value={selectedCourseId}
              onChange={(val) => {
                setSelectedCourseId(val);
              }}
              placeholder={selectedUniId ? 'Pick your course' : 'Select university first'}
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
          disabled={!selectedCourseId}
          variant="gradient"
          gradient={{ from: 'blue.5', to: 'indigo.6', deg: 90 }}
          styles={{
            root: {
              boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)',
              transition: 'all 0.2s ease',
              border: 'none',
            },
            label: { fontWeight: 700, fontSize: '17px', letterSpacing: '0.3px' },
          }}
          rightSection={<ArrowRight size={20} strokeWidth={3} />}
        >
          Initialize AI Copilot
        </Button>
      </Stack>
    </Modal>
  );
};

export default NewSessionModal;
