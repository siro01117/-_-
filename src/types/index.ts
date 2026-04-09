// ================================================
// 학원 관리 시스템 - 타입 정의
// ================================================

export type UserRole = string;          // DB roles.name 과 매핑되는 문자열 (admin | manager | user | 커스텀)
export type ApprovalStatus = 'pending' | 'approved';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

// ── 역할 ──────────────────────────────────────────────────────────
export interface RoleRow {
  id:             string;
  name:           string;             // 내부 키 (slug)
  label:          string;             // 화면 표시 이름
  color:          string;
  permissions:    Record<string, string[]>; // { categoryId: moduleKey[] }
  category_order: string[];           // 보여줄 카테고리 순서
  show_in_signup: boolean;
  created_at:     string;
}

// ── 프로필 (확장) ─────────────────────────────────────────────────
export interface Profile {
  id:              string;
  email:           string;
  name:            string;
  role:            UserRole;
  login_id?:       string;
  birthdate?:      string;
  school?:         string;
  phone?:          string;
  gender?:         string;
  approval_status: ApprovalStatus;
  created_at:      string;
  updated_at:      string;
}

export interface Student {
  id: string;
  profile_id: string;
  grade?: string;
  school?: string;
  parent_name?: string;
  parent_phone?: string;
  memo?: string;
  created_at: string;
  // 조인 데이터
  profile?: Profile;
}

export interface Teacher {
  id: string;
  profile_id: string;
  subject?: string;
  bio?: string;
  created_at: string;
  // 조인 데이터
  profile?: Profile;
}

export interface Classroom {
  id: string;
  name: string;
  capacity?: number;
  floor?: number;
  seat_layout?: object;
  description?: string;
  created_at: string;
}

export interface Course {
  id: string;
  name: string;
  teacher_id?: string;
  classroom_id?: string;
  description?: string;
  max_students: number;
  is_active: boolean;
  created_at: string;
  // 조인 데이터
  teacher?: Teacher;
  classroom?: Classroom;
}

export interface ClassroomSchedule {
  id: string;
  course_id: string;
  teacher_id?: string;
  classroom_id?: string;
  day: DayOfWeek;
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
  effective_from: string;
  effective_until?: string;
  created_at: string;
  // 조인 데이터
  course?: Course;
  teacher?: Teacher;
  classroom?: Classroom;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  is_active: boolean;
  // 조인 데이터
  course?: Course;
  student?: Student;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  due_date?: string;
  week_start?: string;
  created_at: string;
  // 조인 데이터
  course?: Course;
}

export interface StudentAssignment {
  id: string;
  assignment_id: string;
  student_id: string;
  is_done: boolean;
  submitted_at?: string;
  memo?: string;
  // 조인 데이터
  assignment?: Assignment;
}

export interface Attendance {
  id: string;
  student_id: string;
  course_id: string;
  date: string;
  status: AttendanceStatus;
  seat_no?: string;
  memo?: string;
  created_at: string;
}

export interface LunchOrder {
  id: string;
  student_id: string;
  year: number;
  month: number;
  order_dates: string[];  // ["2026-04-07", "2026-04-08"]
  submitted_at: string;
  updated_at: string;
}

// 요일 한글 매핑
export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: '출석',
  absent: '결석',
  late: '지각',
  excused: '공결',
};
