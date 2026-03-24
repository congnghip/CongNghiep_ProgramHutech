--
-- PostgreSQL database dump
--

\restrict 8qLqS24cIZZwLYK0097rtpe1BzTcGxSg4Q6GwUVxcqbSvhwxjN5mLpzs0NtgCZD

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: program
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO program;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: program
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approval_logs; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.approval_logs (
    id integer NOT NULL,
    entity_type character varying(30) NOT NULL,
    entity_id integer NOT NULL,
    step character varying(30) NOT NULL,
    action character varying(20) NOT NULL,
    reviewer_id integer,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.approval_logs OWNER TO program;

--
-- Name: approval_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.approval_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.approval_logs_id_seq OWNER TO program;

--
-- Name: approval_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.approval_logs_id_seq OWNED BY public.approval_logs.id;


--
-- Name: assessment_plans; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.assessment_plans (
    id integer NOT NULL,
    version_id integer,
    plo_id integer,
    pi_id integer,
    sample_course_id integer,
    assessment_tool character varying(200),
    criteria character varying(200),
    threshold character varying(200),
    semester character varying(30),
    assessor character varying(200),
    dept_code character varying(20)
);


ALTER TABLE public.assessment_plans OWNER TO program;

--
-- Name: assessment_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.assessment_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.assessment_plans_id_seq OWNER TO program;

--
-- Name: assessment_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.assessment_plans_id_seq OWNED BY public.assessment_plans.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(100),
    target character varying(200),
    details text,
    ip character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO program;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO program;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: clo_plo_map; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.clo_plo_map (
    clo_id integer NOT NULL,
    plo_id integer NOT NULL,
    contribution_level integer DEFAULT 1
);


ALTER TABLE public.clo_plo_map OWNER TO program;

--
-- Name: course_clos; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.course_clos (
    id integer NOT NULL,
    version_course_id integer,
    code character varying(20),
    description text
);


ALTER TABLE public.course_clos OWNER TO program;

--
-- Name: course_clos_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.course_clos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.course_clos_id_seq OWNER TO program;

--
-- Name: course_clos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.course_clos_id_seq OWNED BY public.course_clos.id;


--
-- Name: course_plo_map; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.course_plo_map (
    version_id integer,
    course_id integer NOT NULL,
    plo_id integer NOT NULL,
    contribution_level integer DEFAULT 0
);


ALTER TABLE public.course_plo_map OWNER TO program;

--
-- Name: courses; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.courses (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(300) NOT NULL,
    credits integer DEFAULT 3,
    department_id integer,
    description text
);


ALTER TABLE public.courses OWNER TO program;

--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.courses_id_seq OWNER TO program;

--
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    parent_id integer,
    code character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    type character varying(20) DEFAULT 'KHOA'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.departments OWNER TO program;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.departments_id_seq OWNER TO program;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    code character varying(60) NOT NULL,
    module character varying(30) NOT NULL,
    description character varying(200)
);


ALTER TABLE public.permissions OWNER TO program;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.permissions_id_seq OWNER TO program;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: plo_pis; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.plo_pis (
    id integer NOT NULL,
    plo_id integer,
    pi_code character varying(20) NOT NULL,
    description text
);


ALTER TABLE public.plo_pis OWNER TO program;

--
-- Name: plo_pis_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.plo_pis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.plo_pis_id_seq OWNER TO program;

--
-- Name: plo_pis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.plo_pis_id_seq OWNED BY public.plo_pis.id;


--
-- Name: po_plo_map; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.po_plo_map (
    version_id integer,
    po_id integer NOT NULL,
    plo_id integer NOT NULL
);


ALTER TABLE public.po_plo_map OWNER TO program;

--
-- Name: program_versions; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.program_versions (
    id integer NOT NULL,
    program_id integer,
    academic_year character varying(20) NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying,
    is_locked boolean DEFAULT false,
    copied_from_id integer,
    completion_pct integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_rejected boolean DEFAULT false,
    rejection_reason text,
    version_name character varying(300),
    total_credits integer,
    training_duration character varying(50),
    change_type character varying(50),
    effective_date date,
    change_summary text,
    grading_scale text,
    graduation_requirements text,
    job_positions text,
    further_education text,
    reference_programs text,
    training_process text,
    admission_targets text,
    admission_criteria text
);


ALTER TABLE public.program_versions OWNER TO program;

--
-- Name: program_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.program_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.program_versions_id_seq OWNER TO program;

--
-- Name: program_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.program_versions_id_seq OWNED BY public.program_versions.id;


--
-- Name: programs; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.programs (
    id integer NOT NULL,
    department_id integer,
    name character varying(300) NOT NULL,
    code character varying(30),
    degree character varying(50) DEFAULT 'Đại học'::character varying,
    total_credits integer,
    created_at timestamp with time zone DEFAULT now(),
    name_en character varying(300),
    institution character varying(300),
    degree_name character varying(300),
    training_mode character varying(100),
    notes text
);


ALTER TABLE public.programs OWNER TO program;

--
-- Name: programs_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.programs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.programs_id_seq OWNER TO program;

--
-- Name: programs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.programs_id_seq OWNED BY public.programs.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO program;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    is_system boolean DEFAULT true
);


ALTER TABLE public.roles OWNER TO program;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_seq OWNER TO program;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: syllabus_assignments; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.syllabus_assignments (
    id integer NOT NULL,
    syllabus_id integer,
    user_id integer,
    assigned_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.syllabus_assignments OWNER TO program;

--
-- Name: syllabus_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.syllabus_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.syllabus_assignments_id_seq OWNER TO program;

--
-- Name: syllabus_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.syllabus_assignments_id_seq OWNED BY public.syllabus_assignments.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    user_id integer,
    role_id integer,
    department_id integer
);


ALTER TABLE public.user_roles OWNER TO program;

--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_roles_id_seq OWNER TO program;

--
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    display_name character varying(200) NOT NULL,
    email character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    department_id integer
);


ALTER TABLE public.users OWNER TO program;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO program;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: version_courses; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.version_courses (
    id integer NOT NULL,
    version_id integer,
    course_id integer,
    semester integer,
    course_type character varying(20) DEFAULT 'required'::character varying
);


ALTER TABLE public.version_courses OWNER TO program;

--
-- Name: version_courses_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.version_courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.version_courses_id_seq OWNER TO program;

--
-- Name: version_courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.version_courses_id_seq OWNED BY public.version_courses.id;


--
-- Name: version_objectives; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.version_objectives (
    id integer NOT NULL,
    version_id integer,
    code character varying(20) NOT NULL,
    description text
);


ALTER TABLE public.version_objectives OWNER TO program;

--
-- Name: version_objectives_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.version_objectives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.version_objectives_id_seq OWNER TO program;

--
-- Name: version_objectives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.version_objectives_id_seq OWNED BY public.version_objectives.id;


--
-- Name: version_pi_courses; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.version_pi_courses (
    id integer NOT NULL,
    version_id integer,
    pi_id integer,
    course_id integer,
    contribution_level integer DEFAULT 0
);


ALTER TABLE public.version_pi_courses OWNER TO program;

--
-- Name: version_pi_courses_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.version_pi_courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.version_pi_courses_id_seq OWNER TO program;

--
-- Name: version_pi_courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.version_pi_courses_id_seq OWNED BY public.version_pi_courses.id;


--
-- Name: version_plos; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.version_plos (
    id integer NOT NULL,
    version_id integer,
    code character varying(20) NOT NULL,
    bloom_level integer DEFAULT 1,
    description text
);


ALTER TABLE public.version_plos OWNER TO program;

--
-- Name: version_plos_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.version_plos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.version_plos_id_seq OWNER TO program;

--
-- Name: version_plos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.version_plos_id_seq OWNED BY public.version_plos.id;


--
-- Name: version_syllabi; Type: TABLE; Schema: public; Owner: program
--

CREATE TABLE public.version_syllabi (
    id integer NOT NULL,
    version_id integer,
    course_id integer,
    author_id integer,
    status character varying(30) DEFAULT 'draft'::character varying,
    content jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_rejected boolean DEFAULT false,
    rejection_reason text
);


ALTER TABLE public.version_syllabi OWNER TO program;

--
-- Name: version_syllabi_id_seq; Type: SEQUENCE; Schema: public; Owner: program
--

CREATE SEQUENCE public.version_syllabi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.version_syllabi_id_seq OWNER TO program;

--
-- Name: version_syllabi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: program
--

ALTER SEQUENCE public.version_syllabi_id_seq OWNED BY public.version_syllabi.id;


--
-- Name: approval_logs id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.approval_logs ALTER COLUMN id SET DEFAULT nextval('public.approval_logs_id_seq'::regclass);


--
-- Name: assessment_plans id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.assessment_plans ALTER COLUMN id SET DEFAULT nextval('public.assessment_plans_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: course_clos id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.course_clos ALTER COLUMN id SET DEFAULT nextval('public.course_clos_id_seq'::regclass);


--
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: plo_pis id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.plo_pis ALTER COLUMN id SET DEFAULT nextval('public.plo_pis_id_seq'::regclass);


--
-- Name: program_versions id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.program_versions ALTER COLUMN id SET DEFAULT nextval('public.program_versions_id_seq'::regclass);


--
-- Name: programs id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.programs ALTER COLUMN id SET DEFAULT nextval('public.programs_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: syllabus_assignments id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.syllabus_assignments ALTER COLUMN id SET DEFAULT nextval('public.syllabus_assignments_id_seq'::regclass);


--
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: version_courses id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_courses ALTER COLUMN id SET DEFAULT nextval('public.version_courses_id_seq'::regclass);


--
-- Name: version_objectives id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_objectives ALTER COLUMN id SET DEFAULT nextval('public.version_objectives_id_seq'::regclass);


--
-- Name: version_pi_courses id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_pi_courses ALTER COLUMN id SET DEFAULT nextval('public.version_pi_courses_id_seq'::regclass);


--
-- Name: version_plos id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_plos ALTER COLUMN id SET DEFAULT nextval('public.version_plos_id_seq'::regclass);


--
-- Name: version_syllabi id; Type: DEFAULT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_syllabi ALTER COLUMN id SET DEFAULT nextval('public.version_syllabi_id_seq'::regclass);


--
-- Data for Name: approval_logs; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.approval_logs (id, entity_type, entity_id, step, action, reviewer_id, notes, created_at) FROM stdin;
1	program_version	2	submit	submitted	1	Nộp duyệt	2026-03-16 08:31:43.316475+00
2	program_version	2	submitted	approved	1	Đã duyệt	2026-03-16 08:31:49.515335+00
3	program_version	2	approved_khoa	rejected	1	Từ chối	2026-03-16 08:31:54.280693+00
4	program_version	2	submit	submitted	1	Nộp duyệt	2026-03-16 08:32:28.131497+00
5	program_version	2	submitted	approved	1	Đã duyệt	2026-03-16 08:32:37.110168+00
6	program_version	2	approved_khoa	approved	1	Đã duyệt	2026-03-16 08:32:38.161231+00
7	program_version	2	approved_pdt	approved	1	Đã duyệt	2026-03-16 08:32:40.281436+00
8	program_version	3	submit	submitted	1	Nộp duyệt	2026-03-16 08:33:10.912689+00
9	program_version	3	submitted	approved	1	Đã duyệt	2026-03-16 08:33:14.954663+00
10	program_version	3	approved_khoa	approved	1	Đã duyệt	2026-03-16 08:33:19.062148+00
11	program_version	3	approved_pdt	rejected	1	Từ chối	2026-03-16 08:33:20.898091+00
12	program_version	3	submit	submitted	1	Nộp duyệt	2026-03-16 15:50:28.891321+00
13	program_version	3	submitted	rejected	1	Từ chối	2026-03-16 15:50:33.17968+00
14	program_version	4	submit	submitted	1	Nộp duyệt	2026-03-17 07:37:43.56291+00
15	program_version	4	submitted	rejected	2	Từ chối	2026-03-17 07:37:55.359891+00
16	program_version	4	submit	submitted	1	Nộp duyệt	2026-03-17 10:57:38.032385+00
17	program_version	4	submitted	approved	2	Đã duyệt	2026-03-17 10:57:59.877408+00
18	program_version	4	approved_khoa	approved	2	Đã duyệt	2026-03-17 10:58:02.945339+00
19	program_version	4	approved_pdt	approved	2	Đã duyệt	2026-03-17 10:58:04.447005+00
20	program_version	3	submit	submitted	1	Nộp duyệt	2026-03-17 11:02:20.903536+00
21	program_version	3	submitted	approved	1	Đã duyệt	2026-03-17 11:05:10.693206+00
22	program_version	3	approved_khoa	rejected	1	Từ chối	2026-03-17 11:05:28.751052+00
23	program_version	3	submit	submitted	1	Nộp duyệt	2026-03-17 11:07:04.058247+00
24	program_version	3	submitted	approved	4	Đã duyệt	2026-03-17 11:09:28.50359+00
25	program_version	3	approved_khoa	rejected	5	Từ chối	2026-03-17 11:10:06.722018+00
26	program_version	3	submit	submitted	1	Nộp duyệt	2026-03-17 11:11:04.586237+00
27	program_version	3	submitted	rejected	2	Từ chối	2026-03-17 11:11:39.6035+00
28	program_version	3	submit	submitted	1	Nộp duyệt	2026-03-17 11:47:32.986691+00
29	program_version	3	submitted	approved	4	Đã duyệt	2026-03-17 11:48:25.137817+00
30	program_version	3	approved_khoa	rejected	1	Từ chối	2026-03-17 11:54:01.010624+00
31	program_version	6	submit	submitted	2	Nộp duyệt	2026-03-17 12:54:55.976398+00
32	program_version	6	submitted	rejected	1	Từ chối	2026-03-17 12:55:11.807322+00
33	program_version	7	submit	submitted	2	Nộp duyệt	2026-03-17 14:45:35.563754+00
34	program_version	7	submitted	approved	2	Đã duyệt	2026-03-17 14:45:39.61781+00
35	program_version	7	approved_khoa	rejected	2	Từ chối	2026-03-17 14:45:41.420037+00
36	syllabus	3	submit	submitted	1	Nộp duyệt	2026-03-17 15:27:34.686982+00
37	syllabus	3	submitted	rejected	1	Từ chối	2026-03-17 15:27:53.630046+00
38	syllabus	3	submit	submitted	2	Nộp duyệt	2026-03-17 15:31:09.826637+00
39	syllabus	3	submitted	rejected	1	Từ chối	2026-03-17 15:31:37.166018+00
40	syllabus	3	submit	submitted	1	Nộp duyệt	2026-03-18 01:56:01.227194+00
41	syllabus	3	submitted	approved	1	Đã duyệt	2026-03-18 01:56:08.08182+00
42	syllabus	3	approved_tbm	approved	1	Đã duyệt	2026-03-18 01:56:09.841281+00
43	syllabus	3	approved_khoa	approved	1	Đã duyệt	2026-03-18 01:56:11.595807+00
44	syllabus	3	approved_pdt	approved	1	Đã duyệt	2026-03-18 01:56:15.118704+00
45	program_version	7	submit	submitted	1	Nộp duyệt	2026-03-18 04:28:15.226612+00
46	program_version	7	submitted	approved	1	Đã duyệt	2026-03-18 04:28:20.805612+00
47	program_version	7	approved_khoa	rejected	1	Từ chối	2026-03-18 04:28:22.70585+00
48	program_version	7	submit	submitted	1	Nộp duyệt	2026-03-18 04:28:32.444816+00
49	program_version	7	submitted	approved	1	Đã duyệt	2026-03-18 04:28:39.032325+00
50	program_version	7	approved_khoa	approved	1	Đã duyệt	2026-03-18 04:28:40.04035+00
51	program_version	7	approved_pdt	rejected	1	Từ chối	2026-03-18 04:28:41.959692+00
52	program_version	7	submit	submitted	1	Nộp duyệt	2026-03-18 05:27:16.469361+00
53	program_version	7	submitted	approved	3	Đã duyệt	2026-03-18 05:45:37.321601+00
54	program_version	7	approved_khoa	approved	5	Đã duyệt	2026-03-18 05:46:10.874286+00
55	program_version	7	approved_pdt	rejected	6	Yêu cầu chỉnh sửa	2026-03-18 05:53:18.664339+00
56	program_version	7	approved_khoa	rejected	1	huy	2026-03-18 06:11:05.086025+00
57	program_version	7	submitted	approved	1	Đã duyệt	2026-03-18 06:11:24.959193+00
58	program_version	7	approved_khoa	approved	1	Đã duyệt	2026-03-18 06:11:26.555748+00
59	program_version	7	approved_pdt	rejected	1	huy	2026-03-18 06:11:56.278466+00
60	program_version	7	approved_khoa	rejected	5	Yêu cầu chỉnh sửa	2026-03-18 06:13:44.18495+00
61	program_version	7	submitted	rejected	4	Yêu cầu chỉnh sửa	2026-03-18 06:18:23.750681+00
62	program_version	7	submit	submitted	1	Nộp duyệt	2026-03-18 06:21:19.230534+00
63	program_version	7	submitted	approved	1	Đã duyệt	2026-03-18 06:21:23.635942+00
64	program_version	7	approved_khoa	approved	1	Đã duyệt	2026-03-18 06:21:24.917041+00
65	program_version	7	approved_pdt	rejected	1	Yêu cầu chỉnh sửa	2026-03-18 06:22:14.416883+00
66	program_version	7	approved_khoa	rejected	1	Yêu cầu chỉnh sửa	2026-03-18 06:22:16.808929+00
67	program_version	7	submitted	rejected	1	Yêu cầu chỉnh sửa	2026-03-18 06:22:19.213081+00
68	program_version	7	submit	submitted	1	Nộp duyệt	2026-03-18 06:24:27.364793+00
69	program_version	7	submitted	approved	1	Đã duyệt	2026-03-18 06:25:35.097551+00
70	program_version	7	approved_khoa	approved	1	Đã duyệt	2026-03-18 06:25:38.44668+00
71	program_version	7	approved_pdt	approved	1	Đã duyệt	2026-03-18 06:25:39.639859+00
72	program_version	8	submit	submitted	1	Nộp duyệt	2026-03-18 06:26:05.6518+00
73	program_version	8	submitted	approved	1	Đã duyệt	2026-03-18 06:26:09.017381+00
74	program_version	8	approved_khoa	rejected	1	Yêu cầu chỉnh sửa	2026-03-18 06:26:10.677484+00
75	program_version	8	submitted	rejected	1	Yêu cầu chỉnh sửa	2026-03-19 08:20:28.194921+00
76	program_version	8	submit	submitted	1	Nộp duyệt	2026-03-19 08:20:53.637049+00
77	program_version	8	submitted	approved	4	Đã duyệt	2026-03-19 08:21:14.355822+00
78	program_version	8	approved_khoa	rejected	1	Yêu cầu chỉnh sửa	2026-03-19 08:22:57.96992+00
79	program_version	8	submitted	rejected	1	Yêu cầu chỉnh sửa	2026-03-19 08:26:16.380947+00
80	syllabus	9	submit	submitted	12	Nộp duyệt	2026-03-24 07:15:12.910446+00
81	syllabus	9	submitted	approved	11	Đã duyệt	2026-03-24 07:21:31.737017+00
82	syllabus	9	approved_tbm	approved	4	Đã duyệt	2026-03-24 07:23:23.255726+00
83	syllabus	10	submit	submitted	12	Nộp duyệt	2026-03-24 07:29:45.649396+00
84	syllabus	10	submitted	approved	13	Đã duyệt	2026-03-24 07:32:16.530719+00
85	syllabus	10	approved_tbm	rejected	4	đ	2026-03-24 07:32:43.021477+00
86	syllabus	10	submit	submitted	12	Nộp duyệt	2026-03-24 07:39:44.784219+00
87	syllabus	10	submitted	approved	13	Đã duyệt	2026-03-24 07:40:51.475321+00
88	syllabus	10	approved_tbm	rejected	4	Yêu cầu chỉnh sửa	2026-03-24 07:41:43.065976+00
89	syllabus	10	submitted	approved	13	Đã duyệt	2026-03-24 07:42:46.056946+00
90	syllabus	10	approved_tbm	approved	4	Đã duyệt	2026-03-24 07:43:36.550077+00
91	syllabus	9	approved_khoa	rejected	5	Yêu cầu chỉnh sửa	2026-03-24 07:51:11.408833+00
92	syllabus	10	approved_khoa	rejected	5	d	2026-03-24 07:51:14.751077+00
93	syllabus	10	approved_tbm	rejected	4	Yêu cầu chỉnh sửa	2026-03-24 07:51:37.637321+00
94	syllabus	9	approved_tbm	rejected	4	Yêu cầu chỉnh sửa	2026-03-24 07:51:39.061455+00
95	syllabus	9	submitted	approved	13	Đã duyệt	2026-03-24 08:02:38.556203+00
96	syllabus	10	submitted	approved	13	Đã duyệt	2026-03-24 08:02:40.12466+00
97	syllabus	10	approved_tbm	rejected	4	Yêu cầu chỉnh sửa	2026-03-24 08:03:05.631322+00
98	syllabus	9	approved_tbm	approved	4	Đã duyệt	2026-03-24 08:03:10.470691+00
99	syllabus	10	submitted	rejected	13	Yêu cầu chỉnh sửa	2026-03-24 08:11:25.551321+00
100	syllabus	9	approved_khoa	rejected	5	Yêu cầu chỉnh sửa	2026-03-24 08:11:49.785682+00
101	syllabus	9	approved_tbm	rejected	4	Yêu cầu chỉnh sửa	2026-03-24 08:12:02.004468+00
102	syllabus	9	submitted	rejected	13	Yêu cầu chỉnh sửa	2026-03-24 08:12:14.21254+00
103	syllabus	9	submit	submitted	12	Nộp duyệt	2026-03-24 08:54:01.283346+00
104	syllabus	10	submit	submitted	12	Nộp duyệt	2026-03-24 09:33:01.029287+00
\.


--
-- Data for Name: assessment_plans; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.assessment_plans (id, version_id, plo_id, pi_id, sample_course_id, assessment_tool, criteria, threshold, semester, assessor, dept_code) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.audit_logs (id, user_id, action, target, details, ip, created_at) FROM stdin;
1	1	POST /api/versions/1/syllabi	/api/versions/1/syllabi	{"params":{"vId":"1"},"bodyKeys":["course_id","content"]}	172.18.0.1	2026-03-16 07:57:13.23541+00
2	1	POST /api/syllabi/1/clos	/api/syllabi/1/clos	{"params":{"sId":"1"},"bodyKeys":["code","description"]}	172.18.0.1	2026-03-16 07:59:44.270217+00
3	1	PUT /api/programs/1	/api/programs/1	{"params":{"id":"1"},"bodyKeys":["name","code","department_id","degree","total_credits"]}	172.18.0.1	2026-03-16 08:27:44.499454+00
4	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.18.0.1	2026-03-16 08:29:03.162912+00
5	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 08:29:08.414838+00
6	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:29:09.644118+00
7	2	POST /api/versions/1/syllabi	/api/versions/1/syllabi	{"params":{"vId":"1"},"bodyKeys":["course_id","content"]}	172.18.0.1	2026-03-16 08:29:41.605565+00
8	1	POST /api/programs	/api/programs	{"params":{},"bodyKeys":["name","code","department_id","degree","total_credits"]}	172.18.0.1	2026-03-16 08:31:14.822202+00
9	1	POST /api/programs/2/versions	/api/programs/2/versions	{"params":{"programId":"2"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-16 08:31:31.053903+00
10	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-16 08:31:43.319652+00
11	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-16 08:31:49.51672+00
12	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-16 08:31:54.282342+00
13	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-16 08:32:28.134794+00
14	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-16 08:32:37.111596+00
15	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-16 08:32:38.162682+00
16	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-16 08:32:40.282679+00
17	1	POST /api/programs/2/versions	/api/programs/2/versions	{"params":{"programId":"2"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-16 08:33:00.853362+00
18	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-16 08:33:10.915686+00
19	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-16 08:33:14.956076+00
20	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-16 08:33:19.06345+00
21	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-16 08:33:20.89962+00
22	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:08.2203+00
23	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:08.516205+00
24	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:09.62682+00
25	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:09.804273+00
26	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:09.983848+00
27	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:10.162115+00
28	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:10.340547+00
29	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:10.517618+00
30	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:10.689621+00
31	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:10.867742+00
32	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:11.046069+00
33	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:11.301988+00
34	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:11.551728+00
35	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:11.721802+00
36	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:11.907326+00
37	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:12.093972+00
38	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:12.287561+00
39	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:12.459706+00
40	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:12.646139+00
41	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:12.840446+00
42	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:13.009889+00
43	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:13.196484+00
44	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:13.36017+00
45	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:13.546559+00
46	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:13.71529+00
47	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:13.9099+00
48	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:14.082227+00
49	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:14.289909+00
50	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:14.470184+00
51	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:14.663871+00
52	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:14.85745+00
53	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:15.106803+00
54	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:15.283656+00
55	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:15.470493+00
56	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:15.679792+00
57	1	DELETE /api/users/2/roles/GIANG_VIEN/0	/api/users/2/roles/GIANG_VIEN/0	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"0"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:42:15.889366+00
58	1	DELETE /api/users/2/roles/GIANG_VIEN/1	/api/users/2/roles/GIANG_VIEN/1	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:46:28.718522+00
59	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 08:46:30.134186+00
60	1	DELETE /api/users/2/roles/GIANG_VIEN/1	/api/users/2/roles/GIANG_VIEN/1	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:46:31.401153+00
61	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 08:46:32.014129+00
62	1	DELETE /api/users/2/roles/GIANG_VIEN/1	/api/users/2/roles/GIANG_VIEN/1	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:46:32.689288+00
63	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 08:46:33.434173+00
64	1	DELETE /api/users/2/roles/GIANG_VIEN/1	/api/users/2/roles/GIANG_VIEN/1	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:46:34.304106+00
65	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 08:46:36.606741+00
66	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 08:47:29.21641+00
67	1	DELETE /api/users/2/roles/GIANG_VIEN/1	/api/users/2/roles/GIANG_VIEN/1	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:47:30.169722+00
68	2	POST /api/versions/3/objectives	/api/versions/3/objectives	{"params":{"vId":"3"},"bodyKeys":["code","description"]}	172.18.0.1	2026-03-16 08:48:22.651808+00
69	2	DELETE /api/objectives/4	/api/objectives/4	{"params":{"id":"4"},"bodyKeys":[]}	172.18.0.1	2026-03-16 08:48:25.686511+00
70	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-16 15:50:28.894914+00
71	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-16 15:50:33.18128+00
72	1	DELETE /api/users/2/roles/GIANG_VIEN/5	/api/users/2/roles/GIANG_VIEN/5	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-16 15:52:12.557035+00
73	1	PUT /api/users/2/toggle-active	/api/users/2/toggle-active	{"params":{"id":"2"},"bodyKeys":[]}	172.18.0.1	2026-03-16 15:52:19.521857+00
74	1	PUT /api/users/2/toggle-active	/api/users/2/toggle-active	{"params":{"id":"2"},"bodyKeys":[]}	172.18.0.1	2026-03-16 15:52:20.339552+00
75	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 15:52:23.441782+00
76	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:02.920696+00
77	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:02.929751+00
78	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:02.937414+00
79	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:02.945771+00
80	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:02.951866+00
81	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:02.958105+00
82	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:32.681438+00
83	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:32.690252+00
84	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:32.70634+00
85	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:32.715121+00
86	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:32.721232+00
87	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-16 16:06:32.728503+00
88	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.18.0.1	2026-03-16 16:07:34.61516+00
89	1	POST /api/users/3/roles	/api/users/3/roles	{"params":{"id":"3"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 16:07:41.740671+00
90	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.18.0.1	2026-03-16 16:08:33.338083+00
91	1	POST /api/users/4/roles	/api/users/4/roles	{"params":{"id":"4"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 16:08:38.375005+00
92	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.18.0.1	2026-03-16 16:09:06.940213+00
93	1	POST /api/users/5/roles	/api/users/5/roles	{"params":{"id":"5"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 16:09:12.831703+00
94	1	PUT /api/users/5/toggle-active	/api/users/5/toggle-active	{"params":{"id":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-16 16:09:20.561106+00
95	1	PUT /api/users/5/toggle-active	/api/users/5/toggle-active	{"params":{"id":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-16 16:09:20.793118+00
96	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.18.0.1	2026-03-16 16:09:48.547839+00
97	1	POST /api/users/6/roles	/api/users/6/roles	{"params":{"id":"6"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-16 16:09:54.811036+00
98	1	PUT /api/users/6/toggle-active	/api/users/6/toggle-active	{"params":{"id":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-16 16:09:58.280535+00
99	1	PUT /api/users/6/toggle-active	/api/users/6/toggle-active	{"params":{"id":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-16 16:09:59.24805+00
100	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:30:59.022808+00
101	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:30:59.04093+00
102	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:30:59.0587+00
103	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:30:59.077974+00
104	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:30:59.093472+00
105	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:30:59.112774+00
106	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:31:03.103251+00
107	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:31:03.117681+00
108	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:31:03.139135+00
109	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:31:03.160697+00
110	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:31:03.17495+00
111	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:31:03.193765+00
112	1	DELETE /api/users/5/roles/BAN_GIAM_HIEU/1	/api/users/5/roles/BAN_GIAM_HIEU/1	{"params":{"userId":"5","roleCode":"BAN_GIAM_HIEU","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-17 06:34:53.291692+00
113	1	POST /api/users/5/roles	/api/users/5/roles	{"params":{"id":"5"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 06:34:55.877995+00
114	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:35:25.565385+00
115	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:35:25.57892+00
116	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:35:25.597788+00
117	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:35:25.62054+00
118	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:35:25.636712+00
119	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:35:25.654574+00
120	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.18.0.1	2026-03-17 06:37:38.386661+00
121	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:47.212452+00
122	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:47.225426+00
123	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:47.246878+00
124	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:47.26751+00
125	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:47.280188+00
126	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:47.295151+00
127	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:56.375023+00
128	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:56.388336+00
129	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:56.408754+00
130	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:56.430651+00
131	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:56.445059+00
132	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:43:56.461695+00
133	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:46:12.379261+00
134	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:46:12.392261+00
135	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:46:12.408062+00
136	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:46:12.426377+00
137	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:46:12.440527+00
138	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 06:46:12.457093+00
139	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.18.0.1	2026-03-17 06:53:14.583294+00
140	1	POST /api/users/8/roles	/api/users/8/roles	{"params":{"id":"8"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 06:57:49.690155+00
141	1	DELETE /api/users/8/roles/LANH_DAO_KHOA/1	/api/users/8/roles/LANH_DAO_KHOA/1	{"params":{"userId":"8","roleCode":"LANH_DAO_KHOA","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-17 06:58:23.430159+00
142	1	POST /api/users/8/roles	/api/users/8/roles	{"params":{"id":"8"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 07:02:32.137627+00
143	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 07:34:02.059815+00
144	1	DELETE /api/users/2/roles/GIANG_VIEN/1	/api/users/2/roles/GIANG_VIEN/1	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-17 07:34:03.859982+00
145	1	POST /api/programs/1/versions	/api/programs/1/versions	{"params":{"programId":"1"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-17 07:35:21.958635+00
146	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 07:37:19.672736+00
147	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 07:37:43.564834+00
148	2	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-17 07:37:55.361969+00
149	1	DELETE /api/users/2/roles/GIANG_VIEN/6	/api/users/2/roles/GIANG_VIEN/6	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-17 08:24:52.325108+00
150	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:45:50.648682+00
151	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:45:50.657735+00
152	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:45:50.665751+00
153	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:45:50.672649+00
154	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:45:50.678483+00
155	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:45:50.684938+00
156	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:46:49.209949+00
157	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:46:49.217952+00
158	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:46:49.227134+00
159	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:46:49.235368+00
160	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:46:49.24096+00
161	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:46:49.247824+00
162	2	POST /api/versions/4/courses	/api/versions/4/courses	{"params":{"vId":"4"},"bodyKeys":["course_id","semester","course_type"]}	172.18.0.1	2026-03-17 08:47:15.807554+00
163	2	DELETE /api/version-courses/5	/api/version-courses/5	{"params":{"id":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-17 08:47:18.095702+00
164	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:50:04.057342+00
165	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:50:04.065501+00
166	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:50:04.075012+00
167	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:50:04.085396+00
168	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:50:04.090516+00
169	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 08:50:04.096075+00
170	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:53:03.083675+00
171	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:53:03.091971+00
172	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:53:03.103971+00
173	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:53:03.111743+00
174	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:53:03.117217+00
175	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:53:03.124325+00
176	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 10:57:38.034944+00
177	2	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-17 10:57:59.879479+00
178	2	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-17 10:58:02.946733+00
179	2	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-17 10:58:04.448369+00
180	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:59:16.989933+00
181	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:59:16.996833+00
182	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:59:17.008188+00
183	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:59:17.015862+00
184	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:59:17.02187+00
185	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 10:59:17.02887+00
186	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 11:02:20.905484+00
187	1	POST /api/users/5/roles	/api/users/5/roles	{"params":{"id":"5"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 11:02:46.029938+00
188	1	DELETE /api/users/5/roles/PHONG_DAO_TAO/1	/api/users/5/roles/PHONG_DAO_TAO/1	{"params":{"userId":"5","roleCode":"PHONG_DAO_TAO","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-17 11:02:47.569319+00
189	1	POST /api/users/6/roles	/api/users/6/roles	{"params":{"id":"6"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 11:04:41.911058+00
190	1	DELETE /api/users/6/roles/BAN_GIAM_HIEU/1	/api/users/6/roles/BAN_GIAM_HIEU/1	{"params":{"userId":"6","roleCode":"BAN_GIAM_HIEU","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-17 11:04:43.052513+00
191	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-17 11:05:10.695273+00
192	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-17 11:05:28.753986+00
193	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 11:07:04.060518+00
194	1	POST /api/users/3/roles	/api/users/3/roles	{"params":{"id":"3"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 11:07:47.014944+00
195	1	DELETE /api/users/3/roles/TRUONG_NGANH/1	/api/users/3/roles/TRUONG_NGANH/1	{"params":{"userId":"3","roleCode":"TRUONG_NGANH","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-17 11:07:48.728797+00
196	1	POST /api/users/4/roles	/api/users/4/roles	{"params":{"id":"4"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 11:08:47.08901+00
197	1	DELETE /api/users/4/roles/LANH_DAO_KHOA/1	/api/users/4/roles/LANH_DAO_KHOA/1	{"params":{"userId":"4","roleCode":"LANH_DAO_KHOA","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-17 11:09:00.472465+00
198	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-17 11:09:28.505436+00
199	5	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-17 11:10:06.723955+00
200	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 11:11:04.588529+00
201	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:11:27.334239+00
202	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:11:27.34258+00
203	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:11:27.351987+00
204	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:11:27.360568+00
205	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:11:27.365976+00
206	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:11:27.372124+00
207	2	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-17 11:11:39.605913+00
208	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:13:16.839446+00
209	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:13:16.847428+00
210	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:13:16.857055+00
211	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:13:16.865475+00
212	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:13:16.870973+00
213	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:13:16.877233+00
214	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:25:43.923573+00
215	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:25:43.93129+00
216	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:25:43.942532+00
217	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:25:43.951408+00
218	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:25:43.957441+00
219	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:25:43.964236+00
220	1	POST /api/users/1/roles	/api/users/1/roles	{"params":{"id":"1"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 11:26:00.605317+00
221	1	DELETE /api/users/1/roles/GIANG_VIEN/6	/api/users/1/roles/GIANG_VIEN/6	{"params":{"userId":"1","roleCode":"GIANG_VIEN","deptId":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-17 11:26:29.163911+00
222	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 11:26:36.596651+00
223	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:27:24.144062+00
224	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:27:24.152302+00
225	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:27:24.161029+00
226	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:27:24.168548+00
227	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:27:24.173623+00
228	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:27:24.179515+00
229	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:34:32.714246+00
230	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:34:32.722555+00
231	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:34:32.732356+00
232	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:34:32.742582+00
233	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:34:32.747995+00
234	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:34:32.754184+00
235	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:41:04.032008+00
236	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:41:04.040966+00
237	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:41:04.050335+00
238	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:41:04.060141+00
239	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:41:04.065344+00
240	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:41:04.071695+00
241	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 11:47:32.988889+00
242	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-17 11:48:25.139962+00
243	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-17 11:54:01.012495+00
244	1	DELETE /api/versions/3	/api/versions/3	{"params":{"id":"3"},"bodyKeys":[]}	172.18.0.1	2026-03-17 11:54:05.218164+00
245	1	POST /api/programs/2/versions	/api/programs/2/versions	{"params":{"programId":"2"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-17 11:54:35.330604+00
246	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:55:11.057043+00
247	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:55:11.065017+00
248	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:55:11.074063+00
249	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:55:11.08264+00
250	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:55:11.088993+00
251	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 11:55:11.095875+00
252	2	DELETE /api/versions/5	/api/versions/5	{"params":{"id":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-17 11:55:22.872985+00
253	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:03:42.039122+00
254	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:03:42.048072+00
255	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:03:42.064752+00
256	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:03:42.072676+00
257	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:03:42.078293+00
258	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:03:42.08466+00
259	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:04:37.132083+00
260	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:04:37.140819+00
261	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:04:37.149854+00
262	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:04:37.160052+00
263	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:04:37.166211+00
264	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:04:37.172873+00
265	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:24:55.549054+00
266	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:24:55.556611+00
267	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:24:55.56542+00
268	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:24:55.573372+00
269	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:24:55.579018+00
270	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:24:55.586015+00
271	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:25:49.250045+00
272	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:25:49.258034+00
273	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:25:49.267323+00
274	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:25:49.275297+00
275	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:25:49.281074+00
276	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:25:49.287948+00
277	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:48:43.701953+00
278	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:48:43.709819+00
279	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:48:43.72+00
280	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:48:43.728455+00
281	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:48:43.734514+00
282	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:48:43.741113+00
283	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:49:25.07858+00
284	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:49:25.087129+00
285	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:49:25.095955+00
286	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:49:25.104123+00
287	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:49:25.109702+00
288	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:49:25.116061+00
289	1	POST /api/programs/1/versions	/api/programs/1/versions	{"params":{"programId":"1"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-17 12:50:12.933051+00
290	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:51:35.749978+00
291	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:51:35.757908+00
292	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:51:35.766849+00
293	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:51:35.774452+00
294	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:51:35.780661+00
295	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:51:35.787071+00
296	2	POST /api/versions/6/courses	/api/versions/6/courses	{"params":{"vId":"6"},"bodyKeys":["course_id","semester","course_type"]}	172.18.0.1	2026-03-17 12:51:51.919041+00
297	2	DELETE /api/version-courses/6	/api/version-courses/6	{"params":{"id":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-17 12:51:54.303861+00
298	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:54.274128+00
299	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:54.282235+00
300	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:54.291211+00
301	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:54.298598+00
302	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:54.30396+00
303	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:54.310263+00
304	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:59.555916+00
305	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:59.5648+00
306	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:59.580965+00
307	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:59.588718+00
308	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:59.594069+00
309	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:52:59.600166+00
310	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:53:58.241882+00
311	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:53:58.249414+00
312	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:53:58.258858+00
313	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:53:58.266594+00
314	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:53:58.271817+00
315	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 12:53:58.278372+00
316	2	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 12:54:55.978956+00
317	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-17 12:55:11.809354+00
318	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:50:12.622239+00
319	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:50:12.628977+00
320	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:50:12.638245+00
321	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:50:12.647113+00
322	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:50:12.653045+00
323	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:50:12.659524+00
324	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:51:24.66542+00
325	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:51:24.673546+00
326	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:51:24.682513+00
327	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:51:24.690979+00
328	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:51:24.696157+00
329	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 13:51:24.702743+00
330	1	POST /api/programs/1/versions	/api/programs/1/versions	{"params":{"programId":"1"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-17 14:05:00.203143+00
331	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:03.28934+00
332	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:03.297097+00
333	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:03.305398+00
334	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:03.314364+00
335	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:03.320585+00
336	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:03.328013+00
337	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:54.801053+00
338	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:54.809972+00
339	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:54.818441+00
340	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:54.826086+00
341	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:54.832021+00
342	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:07:54.839379+00
343	1	DELETE /api/versions/6	/api/versions/6	{"params":{"id":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-17 14:08:50.883362+00
344	1	POST /api/programs/2/versions	/api/programs/2/versions	{"params":{"programId":"2"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-17 14:15:13.55108+00
345	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:19.109002+00
346	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:19.117037+00
347	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:19.125775+00
348	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:19.133666+00
349	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:19.139691+00
350	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:19.146929+00
351	2	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 14:45:35.565785+00
352	2	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-17 14:45:39.618702+00
353	2	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-17 14:45:41.421294+00
354	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:57.035088+00
355	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:57.043761+00
356	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:57.060228+00
357	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:57.067801+00
358	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:57.073755+00
359	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:45:57.08151+00
360	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:46:49.00961+00
361	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:46:49.016929+00
362	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:46:49.025821+00
363	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:46:49.033016+00
364	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:46:49.038655+00
365	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 14:46:49.045063+00
366	1	POST /api/plos/4/pis	/api/plos/4/pis	{"params":{"ploId":"4"},"bodyKeys":["pi_code","description"]}	172.18.0.1	2026-03-17 14:49:10.899565+00
367	1	DELETE /api/pis/1	/api/pis/1	{"params":{"id":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-17 14:49:12.921287+00
368	1	POST /api/versions/7/courses	/api/versions/7/courses	{"params":{"vId":"7"},"bodyKeys":["course_id","semester","course_type"]}	172.18.0.1	2026-03-17 14:54:00.845055+00
369	1	POST /api/courses	/api/courses	{"params":{},"bodyKeys":["code","name","credits","department_id","description"]}	172.18.0.1	2026-03-17 14:59:32.517971+00
370	1	DELETE /api/courses/12	/api/courses/12	{"params":{"id":"12"},"bodyKeys":[]}	172.18.0.1	2026-03-17 14:59:52.362573+00
371	1	DELETE /api/users/2/roles/GIANG_VIEN/6	/api/users/2/roles/GIANG_VIEN/6	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-17 15:02:07.610595+00
372	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 15:02:08.508027+00
373	1	DELETE /api/users/2/roles/GIANG_VIEN/5	/api/users/2/roles/GIANG_VIEN/5	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-17 15:02:09.462305+00
374	1	DELETE /api/users/2/roles/GIANG_VIEN/1	/api/users/2/roles/GIANG_VIEN/1	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"1"},"bodyKeys":[]}	172.18.0.1	2026-03-17 15:02:12.585304+00
375	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 15:02:14.764558+00
376	1	POST /api/courses	/api/courses	{"params":{},"bodyKeys":["code","name","credits","department_id","description"]}	172.18.0.1	2026-03-17 15:06:37.465898+00
377	1	PUT /api/courses/13	/api/courses/13	{"params":{"id":"13"},"bodyKeys":["code","name","credits","department_id","description"]}	172.18.0.1	2026-03-17 15:06:45.21091+00
378	1	PUT /api/courses/13	/api/courses/13	{"params":{"id":"13"},"bodyKeys":["code","name","credits","department_id","description"]}	172.18.0.1	2026-03-17 15:06:54.563344+00
379	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-17 15:07:32.866641+00
380	1	POST /api/versions/7/courses	/api/versions/7/courses	{"params":{"vId":"7"},"bodyKeys":["course_id","semester","course_type"]}	172.18.0.1	2026-03-17 15:13:04.497388+00
381	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 15:27:34.689058+00
382	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-17 15:27:53.632032+00
383	1	PUT /api/versions/7/po-plo-map	/api/versions/7/po-plo-map	{"params":{"vId":"7"},"bodyKeys":["mappings"]}	172.18.0.1	2026-03-17 15:29:29.347488+00
384	1	PUT /api/versions/7/po-plo-map	/api/versions/7/po-plo-map	{"params":{"vId":"7"},"bodyKeys":["mappings"]}	172.18.0.1	2026-03-17 15:29:32.641283+00
385	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 15:30:51.330685+00
386	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 15:30:51.338391+00
387	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 15:30:51.34799+00
388	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 15:30:51.356273+00
389	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 15:30:51.361932+00
390	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 15:30:51.368021+00
391	2	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-17 15:31:09.82836+00
392	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-17 15:31:37.167661+00
393	4	POST /api/versions/8/courses	/api/versions/8/courses	{"params":{"vId":"8"},"bodyKeys":["course_id","semester","course_type"]}	172.18.0.1	2026-03-17 15:32:58.907411+00
394	4	POST /api/versions/8/syllabi	/api/versions/8/syllabi	{"params":{"vId":"8"},"bodyKeys":["course_id","content"]}	172.18.0.1	2026-03-17 15:33:01.194103+00
395	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 16:06:58.576002+00
396	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 16:06:58.584437+00
397	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 16:06:58.593072+00
398	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 16:06:58.601881+00
399	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 16:06:58.608017+00
400	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-17 16:06:58.614483+00
401	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:07:49.048826+00
402	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:07:49.056616+00
403	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:07:49.065774+00
404	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:07:49.073952+00
405	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:07:49.079334+00
406	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:07:49.084924+00
407	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.360014+00
408	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.367817+00
409	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.375253+00
410	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.381854+00
411	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.386669+00
412	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.392269+00
413	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.580225+00
414	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.58913+00
415	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.598401+00
416	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.607124+00
417	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.612211+00
418	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:56.618254+00
419	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:58.960663+00
420	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:58.968304+00
421	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:58.977199+00
422	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:58.986268+00
423	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:58.991708+00
424	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:58.99828+00
425	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.063365+00
426	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.070999+00
427	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.079122+00
428	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.085939+00
429	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.091325+00
430	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.096969+00
431	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.284807+00
432	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.292108+00
433	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.30148+00
434	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.309926+00
435	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.316096+00
436	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:08:59.32236+00
437	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:09:19.154804+00
438	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:09:19.162915+00
439	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:09:19.17201+00
440	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:09:19.179412+00
441	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:09:19.184581+00
442	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:09:19.190659+00
443	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:13:19.37126+00
444	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:13:19.379159+00
445	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:13:19.388522+00
446	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:13:19.395518+00
447	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:13:19.400788+00
448	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:13:19.406749+00
449	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:31:36.865674+00
450	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:31:36.873932+00
451	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:31:36.883134+00
452	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:31:36.892572+00
453	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:31:36.897704+00
454	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:31:36.903464+00
455	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:32:37.276426+00
456	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:32:37.284612+00
457	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:32:37.294096+00
458	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:32:37.303739+00
459	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:32:37.308898+00
460	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:32:37.315054+00
461	1	DELETE /api/users/2/roles/GIANG_VIEN/5	/api/users/2/roles/GIANG_VIEN/5	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-18 01:34:31.384019+00
462	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:50:25.123868+00
463	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:50:25.132082+00
464	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:50:25.148809+00
465	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:50:25.160187+00
466	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:50:25.165981+00
467	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:50:25.17427+00
468	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:12.328102+00
469	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:12.335877+00
470	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:12.343379+00
471	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:12.351422+00
472	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:12.358945+00
473	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:12.365386+00
474	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:42.860828+00
475	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:42.867774+00
476	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:42.877265+00
477	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:42.885614+00
478	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:42.89138+00
479	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:51:42.898539+00
480	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:52:49.415905+00
481	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:52:49.423644+00
482	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:52:49.432788+00
483	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:52:49.440928+00
484	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:52:49.446179+00
485	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:52:49.453008+00
486	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:54:45.953932+00
487	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:54:45.962104+00
488	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:54:45.971532+00
489	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:54:45.979519+00
490	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:54:45.984609+00
491	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 01:54:45.991823+00
492	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-18 01:56:01.229679+00
493	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 01:56:08.082986+00
494	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 01:56:09.842242+00
495	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 01:56:11.596944+00
496	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 01:56:15.119886+00
497	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:03:37.207792+00
498	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:03:37.215862+00
499	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:03:37.225338+00
500	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:03:37.233803+00
501	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:03:37.239567+00
502	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:03:37.246722+00
503	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:30:36.005264+00
504	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:30:36.014156+00
505	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:30:36.030733+00
506	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:30:36.041416+00
507	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:30:36.04742+00
508	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 02:30:36.055368+00
509	1	POST /api/users/3/roles	/api/users/3/roles	{"params":{"id":"3"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-18 03:23:19.147279+00
510	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:10.794609+00
511	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:10.799783+00
512	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:10.806758+00
513	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:10.81561+00
514	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:10.821921+00
515	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:10.830637+00
516	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:55.673807+00
517	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:55.682689+00
518	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:55.699003+00
519	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:55.710963+00
520	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:55.71727+00
521	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:25:55.7252+00
522	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:27:29.27049+00
523	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:27:29.276125+00
524	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:27:29.282997+00
525	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:27:29.292183+00
526	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:27:29.299129+00
527	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:27:29.307409+00
528	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:39:48.47564+00
529	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:39:48.483362+00
530	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:39:48.492157+00
531	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:39:48.500048+00
532	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:39:48.505378+00
533	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:39:48.512334+00
534	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-18 03:41:54.203144+00
535	1	POST /api/programs	/api/programs	{"params":{},"bodyKeys":["name","code","department_id","degree","total_credits"]}	172.18.0.1	2026-03-18 03:46:31.867367+00
536	1	POST /api/programs/3/versions	/api/programs/3/versions	{"params":{"programId":"3"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-18 03:47:01.770969+00
537	1	DELETE /api/programs/3	/api/programs/3	{"params":{"id":"3"},"bodyKeys":[]}	172.18.0.1	2026-03-18 03:47:10.828975+00
538	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:52:58.013154+00
539	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:52:58.02184+00
540	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:52:58.0385+00
541	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:52:58.045908+00
542	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:52:58.051253+00
543	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:52:58.057783+00
544	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:53:56.341432+00
545	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:53:56.349319+00
546	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:53:56.366896+00
547	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:53:56.374825+00
548	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:53:56.380528+00
549	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:53:56.387861+00
550	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:56:28.848971+00
551	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:56:28.855361+00
552	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:56:28.864653+00
553	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:56:28.872046+00
554	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:56:28.877228+00
555	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:56:28.884065+00
556	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:57:29.357229+00
557	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:57:29.365538+00
558	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:57:29.374979+00
559	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:57:29.382362+00
560	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:57:29.387281+00
561	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 03:57:29.3945+00
562	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-18 04:28:15.229256+00
563	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 04:28:20.807701+00
564	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 04:28:22.707023+00
565	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-18 04:28:32.445875+00
566	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 04:28:39.033409+00
567	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 04:28:40.041748+00
568	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 04:28:41.960845+00
569	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-18 05:27:16.474804+00
570	1	POST /api/programs	/api/programs	{"params":{},"bodyKeys":["name","code","department_id","degree","total_credits"]}	172.18.0.1	2026-03-18 05:28:47.843864+00
571	1	POST /api/programs/4/versions	/api/programs/4/versions	{"params":{"programId":"4"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-18 05:28:53.598669+00
572	1	POST /api/versions/10/courses	/api/versions/10/courses	{"params":{"vId":"10"},"bodyKeys":["course_id","semester","course_type"]}	172.18.0.1	2026-03-18 05:29:14.39692+00
573	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:30:34.315275+00
574	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:30:34.331475+00
575	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:30:34.35613+00
576	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:30:34.380802+00
577	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:30:34.397773+00
578	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:30:34.417693+00
579	1	POST /api/users/4/roles	/api/users/4/roles	{"params":{"id":"4"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-18 05:31:20.680492+00
580	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:22.33976+00
581	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:22.354545+00
582	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:22.373666+00
583	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:22.397649+00
584	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:22.411102+00
585	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:22.432608+00
586	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:28.832301+00
587	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:28.846335+00
588	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:28.867257+00
589	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:28.890353+00
590	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:28.903927+00
591	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:32:28.92264+00
592	1	DELETE /api/programs/4	/api/programs/4	{"params":{"id":"4"},"bodyKeys":[]}	172.18.0.1	2026-03-18 05:33:55.215225+00
593	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:34:59.702245+00
594	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:34:59.714768+00
595	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:34:59.732926+00
596	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:34:59.756229+00
597	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:34:59.770486+00
598	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:34:59.789086+00
599	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:35:59.26969+00
600	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:35:59.283169+00
601	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:35:59.301227+00
602	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:35:59.323649+00
603	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:35:59.337536+00
604	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:35:59.357726+00
605	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:42:54.308348+00
606	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:42:54.323518+00
607	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:42:54.34331+00
608	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:42:54.369032+00
609	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:42:54.384129+00
610	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:42:54.4061+00
611	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:14.511504+00
612	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:14.526338+00
613	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:14.545817+00
614	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:14.569865+00
615	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:14.584581+00
616	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:14.606378+00
617	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:27.345614+00
618	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:27.360093+00
619	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:27.378231+00
620	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:27.401457+00
621	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:27.414252+00
622	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:45:27.436635+00
623	3	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 05:45:37.32509+00
624	5	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 05:46:10.876737+00
625	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:50:04.680271+00
626	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:50:04.694536+00
627	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:50:04.71763+00
628	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:50:04.740996+00
629	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:50:04.754433+00
630	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:50:04.775604+00
631	1	POST /api/users/6/roles	/api/users/6/roles	{"params":{"id":"6"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-18 05:51:36.082787+00
632	1	DELETE /api/users/6/roles/GIANG_VIEN/6	/api/users/6/roles/GIANG_VIEN/6	{"params":{"userId":"6","roleCode":"GIANG_VIEN","deptId":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-18 05:51:37.405716+00
633	1	DELETE /api/users/4/roles/GIANG_VIEN/5	/api/users/4/roles/GIANG_VIEN/5	{"params":{"userId":"4","roleCode":"GIANG_VIEN","deptId":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-18 05:51:46.686998+00
634	1	POST /api/users/4/roles	/api/users/4/roles	{"params":{"id":"4"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-18 05:52:01.811841+00
635	6	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 05:53:18.667736+00
636	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:02.279268+00
637	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:02.294573+00
638	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:02.314484+00
639	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:02.337449+00
640	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:02.350609+00
641	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:02.369444+00
642	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:33.452611+00
643	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:33.466509+00
644	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:33.487487+00
645	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:33.508557+00
646	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:33.521742+00
647	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:56:33.540988+00
648	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:08.295643+00
649	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:08.308951+00
650	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:08.328673+00
651	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:08.351817+00
652	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:08.365089+00
653	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:08.383469+00
654	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:17.043931+00
655	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:17.05726+00
656	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:17.075004+00
657	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:17.094984+00
658	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:17.108444+00
659	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:17.129191+00
660	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:22.586994+00
661	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:22.601506+00
662	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:22.621641+00
663	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:22.642703+00
664	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:22.65667+00
665	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 05:57:22.674684+00
666	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 06:11:05.089783+00
667	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 06:11:24.962162+00
668	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 06:11:26.557376+00
669	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 06:11:56.28197+00
670	5	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 06:13:44.188115+00
671	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 06:18:23.753378+00
672	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:19:07.561603+00
673	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:19:07.576784+00
674	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:19:07.592323+00
675	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:19:07.614598+00
676	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:19:07.629254+00
677	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:19:07.649269+00
678	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-18 06:21:19.234268+00
679	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 06:21:23.637639+00
680	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 06:21:24.919087+00
681	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 06:22:14.420369+00
682	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 06:22:16.810746+00
683	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 06:22:19.21484+00
684	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-18 06:24:27.369227+00
685	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 06:25:35.100963+00
686	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 06:25:38.448779+00
687	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 06:25:39.641934+00
688	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-18 06:26:05.655221+00
689	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-18 06:26:09.019676+00
690	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-18 06:26:10.679231+00
691	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:47:00.938157+00
692	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:47:00.953335+00
693	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:47:00.979661+00
694	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:47:01.00328+00
695	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:47:01.017826+00
696	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 06:47:01.038935+00
697	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:06.155929+00
698	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:06.164847+00
699	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:06.173006+00
700	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:06.181683+00
701	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:06.187714+00
702	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:06.195414+00
703	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:13.589481+00
704	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:13.598275+00
705	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:13.607366+00
706	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:13.615569+00
707	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:13.620912+00
708	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-18 07:08:13.628429+00
709	1	DELETE /api/users/7	/api/users/7	{"params":{"id":"7"},"bodyKeys":[]}	172.18.0.1	2026-03-18 07:41:33.943498+00
710	1	POST /api/programs/1/versions	/api/programs/1/versions	{"params":{"programId":"1"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-18 08:53:00.947041+00
711	1	POST /api/plos/7/pis	/api/plos/7/pis	{"params":{"ploId":"7"},"bodyKeys":["pi_code","description"]}	172.18.0.1	2026-03-18 08:53:12.361171+00
712	1	POST /api/plos/7/pis	/api/plos/7/pis	{"params":{"ploId":"7"},"bodyKeys":["pi_code","description"]}	172.18.0.1	2026-03-18 08:53:28.471649+00
713	1	POST /api/plos/8/pis	/api/plos/8/pis	{"params":{"ploId":"8"},"bodyKeys":["pi_code","description","course_ids"]}	172.18.0.1	2026-03-18 10:00:56.469142+00
714	1	POST /api/plos/9/pis	/api/plos/9/pis	{"params":{"ploId":"9"},"bodyKeys":["pi_code","description","course_ids"]}	172.18.0.1	2026-03-19 06:36:32.38355+00
715	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 06:45:26.914726+00
716	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 06:45:26.923429+00
717	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 06:45:26.935591+00
718	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 06:45:26.946013+00
719	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 06:45:26.951958+00
720	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 06:45:26.960293+00
721	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:19:10.424491+00
722	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:19:10.430417+00
723	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:19:10.437583+00
724	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:19:10.446837+00
725	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:19:10.459218+00
726	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:19:10.467852+00
727	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-19 08:20:28.197458+00
728	1	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.18.0.1	2026-03-19 08:20:53.639218+00
729	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.18.0.1	2026-03-19 08:21:14.357993+00
730	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-19 08:22:57.972017+00
731	1	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.18.0.1	2026-03-19 08:26:16.38335+00
732	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:26:42.876783+00
733	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:26:42.884058+00
734	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:26:42.890837+00
735	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:26:42.899006+00
736	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:26:42.908261+00
737	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:26:42.919615+00
738	3	POST /api/programs/2/versions	/api/programs/2/versions	{"params":{"programId":"2"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-19 08:29:25.2829+00
739	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:29:41.328223+00
740	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:29:41.337301+00
741	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:29:41.353133+00
742	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:29:41.365112+00
743	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:29:41.371349+00
744	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.18.0.1	2026-03-19 08:29:41.381345+00
745	1	DELETE /api/users/3/roles/TRUONG_NGANH/6	/api/users/3/roles/TRUONG_NGANH/6	{"params":{"userId":"3","roleCode":"TRUONG_NGANH","deptId":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-19 08:32:42.037046+00
746	1	POST /api/programs/1/versions	/api/programs/1/versions	{"params":{"programId":"1"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-19 08:33:49.802902+00
747	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.18.0.1	2026-03-23 06:45:59.412178+00
748	1	POST /api/users/9/roles	/api/users/9/roles	{"params":{"id":"9"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-23 06:46:07.305423+00
749	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.18.0.1	2026-03-23 06:46:28.842078+00
750	1	POST /api/users/10/roles	/api/users/10/roles	{"params":{"id":"10"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-23 06:46:35.901153+00
751	1	PUT /api/programs/1	/api/programs/1	{"params":{"id":"1"},"bodyKeys":["name","name_en","code","department_id","degree","total_credits","institution","degree_name","training_mode","notes"]}	172.18.0.1	2026-03-23 07:44:55.720544+00
752	1	POST /api/departments	/api/departments	{"params":{},"bodyKeys":["name","type","parent_id","code"]}	172.18.0.1	2026-03-23 07:49:24.813106+00
753	1	DELETE /api/departments/636	/api/departments/636	{"params":{"id":"636"},"bodyKeys":[]}	172.18.0.1	2026-03-23 08:34:51.70848+00
754	1	POST /api/programs	/api/programs	{"params":{},"bodyKeys":["name","name_en","code","department_id","degree","total_credits","institution","degree_name","training_mode","notes"]}	172.18.0.1	2026-03-23 08:38:21.204128+00
755	1	DELETE /api/users/10	/api/users/10	{"params":{"id":"10"},"bodyKeys":[]}	172.18.0.1	2026-03-23 08:39:04.455777+00
756	1	DELETE /api/users/9	/api/users/9	{"params":{"id":"9"},"bodyKeys":[]}	172.18.0.1	2026-03-23 08:39:05.914758+00
757	1	POST /api/users/3/roles	/api/users/3/roles	{"params":{"id":"3"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-23 08:39:23.1262+00
758	1	DELETE /api/users/3/roles/TRUONG_NGANH/5	/api/users/3/roles/TRUONG_NGANH/5	{"params":{"userId":"3","roleCode":"TRUONG_NGANH","deptId":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-23 08:39:25.123251+00
759	1	PUT /api/programs/1	/api/programs/1	{"params":{"id":"1"},"bodyKeys":["name","name_en","code","department_id","degree","total_credits","institution","degree_name","training_mode","notes"]}	172.18.0.1	2026-03-23 08:41:00.57931+00
760	1	POST /api/programs/5/versions	/api/programs/5/versions	{"params":{"programId":"5"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-23 08:45:43.651092+00
761	1	POST /api/programs	/api/programs	{"params":{},"bodyKeys":["name","name_en","code","department_id","degree","total_credits","institution","degree_name","training_mode","notes"]}	172.18.0.1	2026-03-23 08:48:50.472735+00
762	1	DELETE /api/programs/6	/api/programs/6	{"params":{"id":"6"},"bodyKeys":[]}	172.18.0.1	2026-03-23 08:48:59.126125+00
763	1	DELETE /api/versions/14	/api/versions/14	{"params":{"id":"14"},"bodyKeys":[]}	172.18.0.1	2026-03-23 08:51:53.826857+00
764	1	POST /api/programs/5/versions	/api/programs/5/versions	{"params":{"programId":"5"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-23 08:52:10.001621+00
765	1	DELETE /api/programs/5	/api/programs/5	{"params":{"id":"5"},"bodyKeys":[]}	172.18.0.1	2026-03-23 08:53:26.331036+00
766	1	POST /api/programs	/api/programs	{"params":{},"bodyKeys":["name","name_en","code","department_id","degree","total_credits","institution","degree_name","training_mode","notes"]}	172.18.0.1	2026-03-23 08:53:59.4823+00
767	1	POST /api/programs	/api/programs	{"params":{},"bodyKeys":["name","name_en","code","department_id","degree","total_credits","institution","degree_name","training_mode","notes"]}	172.18.0.1	2026-03-23 08:55:05.067955+00
768	1	POST /api/programs/7/versions	/api/programs/7/versions	{"params":{"programId":"7"},"bodyKeys":["academic_year","copy_from_version_id"]}	172.18.0.1	2026-03-23 08:57:01.322341+00
769	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-23 09:00:11.542605+00
770	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.18.0.1	2026-03-23 09:08:31.693379+00
771	1	PUT /api/programs/2	/api/programs/2	{"params":{"id":"2"},"bodyKeys":["name","name_en","code","department_id","degree","total_credits","institution","degree_name","training_mode","notes"]}	172.21.0.1	2026-03-23 09:45:35.714288+00
772	1	POST /api/versions/13/syllabi	/api/versions/13/syllabi	{"params":{"vId":"13"},"bodyKeys":["course_id","content"]}	172.21.0.1	2026-03-24 03:23:22.142698+00
773	1	DELETE /api/users/2/roles/GIANG_VIEN/6	/api/users/2/roles/GIANG_VIEN/6	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"6"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:27:20.51582+00
774	1	DELETE /api/users/2/roles/GIANG_VIEN/651	/api/users/2/roles/GIANG_VIEN/651	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"651"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:27:21.327197+00
775	1	DELETE /api/users/2/roles/GIANG_VIEN/676	/api/users/2/roles/GIANG_VIEN/676	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"676"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:27:21.83895+00
776	1	DELETE /api/users/2/roles/GIANG_VIEN/1	/api/users/2/roles/GIANG_VIEN/1	{"params":{"userId":"2","roleCode":"GIANG_VIEN","deptId":"1"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:27:22.329809+00
777	1	POST /api/users/2/roles	/api/users/2/roles	{"params":{"id":"2"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 03:27:32.967477+00
778	1	DELETE /api/users/12/roles/GIANG_VIEN/5	/api/users/12/roles/GIANG_VIEN/5	{"params":{"userId":"12","roleCode":"GIANG_VIEN","deptId":"5"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:44:54.100365+00
779	1	POST /api/users/12/roles	/api/users/12/roles	{"params":{"id":"12"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 03:45:03.169959+00
780	1	DELETE /api/users/12/roles/GIANG_VIEN/676	/api/users/12/roles/GIANG_VIEN/676	{"params":{"userId":"12","roleCode":"GIANG_VIEN","deptId":"676"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:45:16.071932+00
781	1	POST /api/users/12/roles	/api/users/12/roles	{"params":{"id":"12"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 03:45:21.428878+00
782	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.21.0.1	2026-03-24 03:46:35.69122+00
783	1	PUT /api/users/13/toggle-active	/api/users/13/toggle-active	{"params":{"id":"13"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:46:37.754356+00
784	1	PUT /api/users/13/toggle-active	/api/users/13/toggle-active	{"params":{"id":"13"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:46:38.755562+00
785	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 03:46:47.941702+00
786	1	DELETE /api/users/13/roles/TRUONG_NGANH/653	/api/users/13/roles/TRUONG_NGANH/653	{"params":{"userId":"13","roleCode":"TRUONG_NGANH","deptId":"653"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:48:00.920296+00
787	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 03:48:47.735678+00
788	1	POST /api/assignments	/api/assignments	{"params":{},"bodyKeys":["syllabus_id","user_ids"]}	172.21.0.1	2026-03-24 03:50:56.630881+00
789	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 03:54:12.089997+00
790	1	POST /api/users/12/roles	/api/users/12/roles	{"params":{"id":"12"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 03:54:21.984847+00
791	1	DELETE /api/users/13/roles/LANH_DAO_KHOA/5	/api/users/13/roles/LANH_DAO_KHOA/5	{"params":{"userId":"13","roleCode":"LANH_DAO_KHOA","deptId":"5"},"bodyKeys":[]}	172.21.0.1	2026-03-24 03:54:33.089686+00
792	1	PUT /api/users/13/toggle-active	/api/users/13/toggle-active	{"params":{"id":"13"},"bodyKeys":[]}	172.21.0.1	2026-03-24 04:17:23.14114+00
793	1	PUT /api/users/13/toggle-active	/api/users/13/toggle-active	{"params":{"id":"13"},"bodyKeys":[]}	172.21.0.1	2026-03-24 04:17:24.443998+00
794	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 04:17:32.573116+00
795	1	DELETE /api/users/13/roles/TRUONG_NGANH/653	/api/users/13/roles/TRUONG_NGANH/653	{"params":{"userId":"13","roleCode":"TRUONG_NGANH","deptId":"653"},"bodyKeys":[]}	172.21.0.1	2026-03-24 04:17:34.813051+00
796	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 04:26:05.921099+00
797	1	PUT /api/users/11	/api/users/11	{"params":{"id":"11"},"bodyKeys":["password"]}	172.21.0.1	2026-03-24 04:26:37.107996+00
798	1	DELETE /api/users/11/roles/TRUONG_NGANH/5	/api/users/11/roles/TRUONG_NGANH/5	{"params":{"userId":"11","roleCode":"TRUONG_NGANH","deptId":"5"},"bodyKeys":[]}	172.21.0.1	2026-03-24 04:27:13.457719+00
799	1	POST /api/users/11/roles	/api/users/11/roles	{"params":{"id":"11"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 04:27:19.34339+00
800	11	POST /api/assignments	/api/assignments	{"params":{},"bodyKeys":["syllabus_id","user_ids"]}	172.21.0.1	2026-03-24 04:31:39.906733+00
801	11	POST /api/assignments	/api/assignments	{"params":{},"bodyKeys":["syllabus_id","user_ids"]}	172.21.0.1	2026-03-24 04:31:52.482228+00
802	1	PUT /api/users/12	/api/users/12	{"params":{"id":"12"},"bodyKeys":["password"]}	172.21.0.1	2026-03-24 04:32:41.914079+00
803	1	POST /api/versions/13/syllabi	/api/versions/13/syllabi	{"params":{"vId":"13"},"bodyKeys":["course_id","content"]}	172.21.0.1	2026-03-24 04:34:02.61137+00
804	1	DELETE /api/users/13/roles/LANH_DAO_KHOA/5	/api/users/13/roles/LANH_DAO_KHOA/5	{"params":{"userId":"13","roleCode":"LANH_DAO_KHOA","deptId":"5"},"bodyKeys":[]}	172.21.0.1	2026-03-24 04:38:39.04763+00
805	1	POST /api/departments	/api/departments	{"params":{},"bodyKeys":["name","type","parent_id","code"]}	172.21.0.1	2026-03-24 04:40:11.050961+00
806	1	DELETE /api/users/13/roles/GIANG_VIEN/653	/api/users/13/roles/GIANG_VIEN/653	{"params":{"userId":"13","roleCode":"GIANG_VIEN","deptId":"653"},"bodyKeys":[]}	172.21.0.1	2026-03-24 04:40:31.700814+00
807	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 04:40:32.398169+00
808	1	PUT /api/programs/2	/api/programs/2	{"params":{"id":"2"},"bodyKeys":["name","name_en","code","department_id","degree","total_credits","institution","degree_name","training_mode","notes"]}	172.21.0.1	2026-03-24 04:41:11.638583+00
809	1	PUT /api/programs/2	/api/programs/2	{"params":{"id":"2"},"bodyKeys":["name","name_en","code","department_id","degree","total_credits","institution","degree_name","training_mode","notes"]}	172.21.0.1	2026-03-24 04:41:28.259474+00
810	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 04:41:53.435455+00
811	1	DELETE /api/users/13/roles/GIANG_VIEN/1	/api/users/13/roles/GIANG_VIEN/1	{"params":{"userId":"13","roleCode":"GIANG_VIEN","deptId":"1"},"bodyKeys":[]}	172.21.0.1	2026-03-24 04:41:54.893475+00
812	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 04:50:28.404351+00
813	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 04:50:28.426683+00
814	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 04:50:28.439777+00
815	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 04:50:28.459987+00
816	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 04:50:28.473896+00
817	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 04:50:28.49684+00
818	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 06:27:57.581122+00
819	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 06:27:57.592905+00
820	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 06:27:57.634323+00
821	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 06:27:57.685608+00
822	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 06:27:57.720822+00
823	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 06:27:57.772527+00
824	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 06:29:42.45029+00
825	1	DELETE /api/users/13/roles/GIANG_VIEN/923	/api/users/13/roles/GIANG_VIEN/923	{"params":{"userId":"13","roleCode":"GIANG_VIEN","deptId":"923"},"bodyKeys":[]}	172.21.0.1	2026-03-24 06:29:55.604933+00
826	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 06:35:28.440401+00
827	1	DELETE /api/users/13/roles/LANH_DAO_KHOA/5	/api/users/13/roles/LANH_DAO_KHOA/5	{"params":{"userId":"13","roleCode":"LANH_DAO_KHOA","deptId":"5"},"bodyKeys":[]}	172.21.0.1	2026-03-24 06:35:30.7562+00
828	1	POST /api/users	/api/users	{"params":{},"bodyKeys":["display_name","email","password","username"]}	172.21.0.1	2026-03-24 06:37:17.458134+00
829	1	POST /api/users/14/roles	/api/users/14/roles	{"params":{"id":"14"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 06:37:28.189083+00
830	2	PUT /api/syllabi/9	/api/syllabi/9	{"params":{"id":"9"},"bodyKeys":["content"]}	172.21.0.1	2026-03-24 06:56:34.904399+00
831	2	PUT /api/syllabi/9	/api/syllabi/9	{"params":{"id":"9"},"bodyKeys":["content"]}	172.21.0.1	2026-03-24 06:56:51.138124+00
832	1	DELETE /api/users/14/roles/GIANG_VIEN/651	/api/users/14/roles/GIANG_VIEN/651	{"params":{"userId":"14","roleCode":"GIANG_VIEN","deptId":"651"},"bodyKeys":[]}	172.21.0.1	2026-03-24 06:57:10.439719+00
833	1	POST /api/users/14/roles	/api/users/14/roles	{"params":{"id":"14"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 06:57:19.839423+00
834	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 06:58:21.160605+00
835	1	DELETE /api/users/13/roles/GIANG_VIEN/652	/api/users/13/roles/GIANG_VIEN/652	{"params":{"userId":"13","roleCode":"GIANG_VIEN","deptId":"652"},"bodyKeys":[]}	172.21.0.1	2026-03-24 06:58:22.287066+00
836	13	POST /api/assignments	/api/assignments	{"params":{},"bodyKeys":["syllabus_id","user_ids"]}	172.21.0.1	2026-03-24 06:58:52.609229+00
837	12	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.21.0.1	2026-03-24 07:15:12.917479+00
838	1	DELETE /api/users/14/roles/GIANG_VIEN/653	/api/users/14/roles/GIANG_VIEN/653	{"params":{"userId":"14","roleCode":"GIANG_VIEN","deptId":"653"},"bodyKeys":[]}	172.21.0.1	2026-03-24 07:20:41.503829+00
839	1	POST /api/users/14/roles	/api/users/14/roles	{"params":{"id":"14"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 07:20:47.527433+00
840	11	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	127.0.0.1	2026-03-24 07:21:31.739115+00
841	1	DELETE /api/users/14/roles/TRUONG_NGANH/651	/api/users/14/roles/TRUONG_NGANH/651	{"params":{"userId":"14","roleCode":"TRUONG_NGANH","deptId":"651"},"bodyKeys":[]}	172.21.0.1	2026-03-24 07:21:55.849652+00
842	1	POST /api/users/14/roles	/api/users/14/roles	{"params":{"id":"14"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 07:22:20.016409+00
843	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.21.0.1	2026-03-24 07:23:23.262994+00
844	12	PUT /api/syllabi/10	/api/syllabi/10	{"params":{"id":"10"},"bodyKeys":["content"]}	172.21.0.1	2026-03-24 07:29:43.731775+00
845	12	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.21.0.1	2026-03-24 07:29:45.656137+00
846	1	DELETE /api/users/14/roles/TRUONG_NGANH/653	/api/users/14/roles/TRUONG_NGANH/653	{"params":{"userId":"14","roleCode":"TRUONG_NGANH","deptId":"653"},"bodyKeys":[]}	172.21.0.1	2026-03-24 07:30:00.917803+00
847	1	POST /api/users/14/roles	/api/users/14/roles	{"params":{"id":"14"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 07:30:10.338748+00
848	13	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.21.0.1	2026-03-24 07:32:16.535103+00
849	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 07:32:43.026161+00
850	12	PUT /api/syllabi/10	/api/syllabi/10	{"params":{"id":"10"},"bodyKeys":["content"]}	172.21.0.1	2026-03-24 07:39:42.078285+00
851	12	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.21.0.1	2026-03-24 07:39:44.790609+00
852	13	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.21.0.1	2026-03-24 07:40:51.48221+00
853	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 07:41:43.068144+00
854	13	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.21.0.1	2026-03-24 07:42:46.062514+00
855	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.21.0.1	2026-03-24 07:43:36.558652+00
856	5	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 07:51:11.416493+00
857	5	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 07:51:14.754478+00
858	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 07:51:37.639716+00
859	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 07:51:39.062727+00
860	13	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.21.0.1	2026-03-24 08:02:38.564931+00
861	13	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.21.0.1	2026-03-24 08:02:40.129001+00
862	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 08:03:05.634092+00
863	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action"]}	172.21.0.1	2026-03-24 08:03:10.47291+00
864	5	POST /api/assignments	/api/assignments	{"params":{},"bodyKeys":["syllabus_id","user_ids"]}	172.21.0.1	2026-03-24 08:10:24.437887+00
865	13	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 08:11:25.554069+00
866	5	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 08:11:49.789004+00
867	4	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 08:12:02.0061+00
868	13	POST /api/approval/review	/api/approval/review	{"params":{},"bodyKeys":["entity_type","entity_id","action","notes"]}	172.21.0.1	2026-03-24 08:12:14.216214+00
869	1	DELETE /api/users/13/roles/TRUONG_NGANH/653	/api/users/13/roles/TRUONG_NGANH/653	{"params":{"userId":"13","roleCode":"TRUONG_NGANH","deptId":"653"},"bodyKeys":[]}	172.21.0.1	2026-03-24 08:14:51.732579+00
870	1	POST /api/users/13/roles	/api/users/13/roles	{"params":{"id":"13"},"bodyKeys":["role_code","department_id"]}	172.21.0.1	2026-03-24 08:14:58.204893+00
871	1	PUT /api/roles/1/permissions	/api/roles/1/permissions	{"params":{"id":"1"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 08:50:41.122634+00
872	1	PUT /api/roles/2/permissions	/api/roles/2/permissions	{"params":{"id":"2"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 08:50:41.141665+00
873	1	PUT /api/roles/3/permissions	/api/roles/3/permissions	{"params":{"id":"3"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 08:50:41.156015+00
874	1	PUT /api/roles/4/permissions	/api/roles/4/permissions	{"params":{"id":"4"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 08:50:41.185115+00
875	1	PUT /api/roles/5/permissions	/api/roles/5/permissions	{"params":{"id":"5"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 08:50:41.205375+00
876	1	PUT /api/roles/6/permissions	/api/roles/6/permissions	{"params":{"id":"6"},"bodyKeys":["permission_ids"]}	172.21.0.1	2026-03-24 08:50:41.229856+00
877	12	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.21.0.1	2026-03-24 08:54:01.28819+00
878	1	POST /api/versions/12/courses	/api/versions/12/courses	{"params":{"vId":"12"},"bodyKeys":["course_id","semester","course_type"]}	172.21.0.1	2026-03-24 08:56:50.614099+00
879	1	DELETE /api/courses/13	/api/courses/13	{"params":{"id":"13"},"bodyKeys":[]}	172.21.0.1	2026-03-24 09:12:35.519499+00
880	12	POST /api/approval/submit	/api/approval/submit	{"params":{},"bodyKeys":["entity_type","entity_id"]}	172.21.0.1	2026-03-24 09:33:01.035879+00
\.


--
-- Data for Name: clo_plo_map; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.clo_plo_map (clo_id, plo_id, contribution_level) FROM stdin;
2	10	1
2	12	1
3	10	1
3	12	3
4	12	2
5	10	2
6	11	2
6	12	3
7	10	1
7	11	1
7	12	2
8	10	1
9	11	3
10	11	1
10	12	3
11	10	2
12	10	3
13	10	2
\.


--
-- Data for Name: course_clos; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.course_clos (id, version_course_id, code, description) FROM stdin;
1	4	CLO1	test
2	22	CLO1	Giải thích được các khái niệm cơ bản của lập trình và mô tả được quy trình giải bài toán trên máy tính.
3	22	CLO2	Viết được chương trình đơn giản sử dụng biến, điều kiện, vòng lặp, hàm và mảng.
4	22	CLO3	Kiểm thử, phát hiện và sửa được lỗi cơ bản trong chương trình.
5	23	CLO1	Phân tích được đặc điểm và độ phức tạp của cấu trúc dữ liệu, thuật toán cơ bản.
6	23	CLO2	Cài đặt được các cấu trúc dữ liệu và thuật toán thông dụng để giải quyết bài toán.
7	23	CLO3	Đánh giá và lựa chọn được lời giải phù hợp dựa trên hiệu năng xử lý.
8	24	CLO1	Trình bày được các khái niệm cơ bản của hệ cơ sở dữ liệu và mô hình quan hệ.
9	24	CLO2	Thiết kế được mô hình dữ liệu và lược đồ cơ sở dữ liệu cho bài toán quản lý.
10	24	CLO3	Sử dụng được SQL để tạo lập, truy vấn và cập nhật dữ liệu.
11	25	CLO1	Vận dụng được logic mệnh đề, tập hợp và quan hệ trong các bài toán rời rạc.
12	25	CLO2	Giải được các bài toán phương pháp đếm, truy hồi và đồ thị cơ bản.
13	25	CLO3	Thực hiện được các lập luận và chứng minh toán học ở mức cơ bản.
\.


--
-- Data for Name: course_plo_map; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.course_plo_map (version_id, course_id, plo_id, contribution_level) FROM stdin;
13	22	10	2
13	22	12	3
13	23	10	2
13	23	11	2
13	23	12	3
13	24	10	1
13	24	11	3
13	24	12	2
13	25	10	3
\.


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.courses (id, code, name, credits, department_id, description) FROM stdin;
1	IT001	Nhập môn lập trình	3	5	Học phần nhập môn lập trình, hình thành nền tảng về tư duy giải thuật và kỹ năng lập trình cơ bản.
2	IT002	Cấu trúc dữ liệu và giải thuật	4	5	Học phần về cấu trúc dữ liệu và giải thuật, tập trung vào cài đặt và đánh giá hiệu năng lời giải.
3	IT003	Cơ sở dữ liệu	3	5	Học phần cơ sở dữ liệu, bao gồm thiết kế mô hình dữ liệu và khai thác dữ liệu bằng SQL.
4	GEN001	Toán rời rạc	3	5	Học phần toán rời rạc cung cấp nền tảng logic và công cụ toán cho ngành CNTT.
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.departments (id, parent_id, code, name, type, created_at) FROM stdin;
1	\N	HUTECH	Trường Đại học Công nghệ TP.HCM	ROOT	2026-03-16 07:48:23.471703+00
2	1	BGH	Ban Giám Hiệu	PHONG	2026-03-16 07:48:23.474905+00
3	1	PDT	Phòng Đào tạo	PHONG	2026-03-16 07:48:23.475853+00
4	1	K.TQH	Khoa Trung Quốc học	KHOA	2026-03-16 07:48:23.476582+00
5	1	K.CNTT	Khoa CNTT	KHOA	2026-03-16 07:48:23.477335+00
6	1	K.TA	Khoa Tiếng Anh	KHOA	2026-03-16 07:48:23.478044+00
7	1	K.QTKD	Khoa QTKD	KHOA	2026-03-16 07:48:23.478737+00
8	1	K.LUAT	Khoa Luật	KHOA	2026-03-16 07:48:23.479468+00
9	1	K.NBH	Khoa Nhật Bản học	KHOA	2026-03-16 07:48:23.480237+00
10	1	VJIT	Viện CNTT Việt-Nhật	VIEN	2026-03-16 07:48:23.481005+00
11	1	V.KHUD	Viện Khoa học ứng dụng	VIEN	2026-03-16 07:48:23.481678+00
12	1	TT.GDTC	TT Giáo dục Thể chất	TRUNG_TAM	2026-03-16 07:48:23.482399+00
13	1	TT.GDCT-QP	TT Giáo dục CT-QP	TRUNG_TAM	2026-03-16 07:48:23.483058+00
14	1	TT.TH-NN-KN	TT Tin học-NN-KN	TRUNG_TAM	2026-03-16 07:48:23.483679+00
651	5	N.CNPM	Ngành Công nghệ phần mềm	BO_MON	2026-03-23 08:34:17.022736+00
652	5	N.HTTT	Ngành Hệ thống thông tin	BO_MON	2026-03-23 08:34:17.026664+00
653	5	N.KTPM	Ngành Kỹ thuật phần mềm	BO_MON	2026-03-23 08:34:17.029294+00
655	7	N.TMDT	Ngành Thương mại điện tử	BO_MON	2026-03-23 08:34:17.032922+00
656	7	N.QTKD-TH	Ngành Quản trị kinh doanh tổng hợp	BO_MON	2026-03-23 08:34:17.03449+00
657	6	N.TACN	Ngành Tiếng Anh chuyên ngành	BO_MON	2026-03-23 08:34:17.039347+00
658	6	N.TATM	Ngành Tiếng Anh thương mại	BO_MON	2026-03-23 08:34:17.044144+00
676	5	N.TTNT	Ngành Trí tuệ nhân tạo	BO_MON	2026-03-23 08:42:03.224659+00
923	6	AV	Ngành Ngôn Ngữ Anh	BO_MON	2026-03-24 04:40:11.043371+00
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.permissions (id, code, module, description) FROM stdin;
1	programs.view_published	programs	Xem CTĐT đã công bố
2	programs.view_draft	programs	Xem CTĐT bản nháp
3	programs.create	programs	Tạo mới CTĐT
4	programs.edit	programs	Chỉnh sửa CTĐT
5	programs.delete_draft	programs	Xóa CTĐT bản nháp
6	programs.submit	programs	Nộp CTĐT để phê duyệt
7	programs.approve_khoa	programs	Duyệt CTĐT cấp Khoa
8	programs.approve_pdt	programs	Duyệt CTĐT cấp Phòng ĐT
9	programs.approve_bgh	programs	Phê duyệt CTĐT cấp BGH
10	programs.export	programs	Xuất báo cáo CTĐT
11	programs.import_word	programs	Import CTĐT từ Word
12	programs.manage_all	programs	Quản lý CTĐT toàn trường
13	programs.create_version	programs	Tạo phiên bản CTĐT mới
512	programs.po.edit	programs_granular	Chỉnh sửa Mục tiêu PO
513	programs.plo.edit	programs_granular	Chỉnh sửa Chuẩn đầu ra PLO & PI
514	programs.courses.edit	programs_granular	Chỉnh sửa Học phần & Kế hoạch GD
515	programs.matrix.edit	programs_granular	Chỉnh sửa Ma trận liên kết (PO-PLO, HP-PLO)
516	programs.assessment.edit	programs_granular	Chỉnh sửa Đánh giá CĐR
20	syllabus.view	syllabus	Xem đề cương đã công bố
21	syllabus.create	syllabus	Tạo đề cương
22	syllabus.edit	syllabus	Chỉnh sửa đề cương
23	syllabus.submit	syllabus	Nộp đề cương để phê duyệt
24	syllabus.approve_tbm	syllabus	Duyệt cấp Trưởng BM
25	syllabus.approve_khoa	syllabus	Duyệt cấp Trưởng Khoa
26	syllabus.approve_pdt	syllabus	Duyệt cấp Phòng ĐT
27	syllabus.approve_bgh	syllabus	Phê duyệt cấp BGH
28	syllabus.assign	syllabus	Phân công GV soạn đề cương
29	courses.view	courses	Xem danh mục học phần
30	courses.create	courses	Tạo học phần mới
31	courses.edit	courses	Chỉnh sửa học phần
32	portfolio.own	portfolio	Quản lý hồ sơ GD của mình
33	portfolio.view_dept	portfolio	Xem hồ sơ GD của Khoa
34	rbac.manage_users	rbac	Quản lý tài khoản
35	rbac.manage_roles	rbac	Quản lý vai trò & phân quyền
36	rbac.manage_departments	rbac	Quản lý đơn vị tổ chức
37	rbac.view_audit_logs	rbac	Xem nhật ký hệ thống
38	rbac.system_config	rbac	Cấu hình hệ thống
\.


--
-- Data for Name: plo_pis; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.plo_pis (id, plo_id, pi_code, description) FROM stdin;
2	7	PI.1.1	
3	7	PI.1.2	
4	8	PI.2.1	
5	9	PI.3.1	
6	10	PI.1.1	Áp dụng kiến thức toán học và lập luận logic để phân tích bài toán CNTT.
7	10	PI.1.2	Mô hình hóa và giải thích vấn đề kỹ thuật bằng công cụ toán rời rạc hoặc phương pháp phân tích cơ bản.
8	11	PI.2.1	Thiết kế cấu trúc dữ liệu, mô hình dữ liệu hoặc thành phần hệ thống đáp ứng yêu cầu bài toán.
9	11	PI.2.2	Đánh giá và điều chỉnh phương án thiết kế dựa trên yêu cầu chức năng cơ bản.
10	12	PI.3.1	Viết và kiểm thử chương trình bằng ngôn ngữ lập trình hoặc SQL để giải quyết bài toán.
11	12	PI.3.2	Sử dụng công cụ lập trình và truy vấn dữ liệu để triển khai lời giải ở mức cơ bản đến trung bình.
\.


--
-- Data for Name: po_plo_map; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.po_plo_map (version_id, po_id, plo_id) FROM stdin;
\.


--
-- Data for Name: program_versions; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.program_versions (id, program_id, academic_year, status, is_locked, copied_from_id, completion_pct, created_at, updated_at, is_rejected, rejection_reason, version_name, total_credits, training_duration, change_type, effective_date, change_summary, grading_scale, graduation_requirements, job_positions, further_education, reference_programs, training_process, admission_targets, admission_criteria) FROM stdin;
11	1	2025-2026	draft	f	7	0	2026-03-18 08:53:00.881962+00	2026-03-18 08:53:00.881962+00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7	1	2028-2030	published	t	1	0	2026-03-17 14:05:00.139118+00	2026-03-18 06:25:39.59843+00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
12	2	2027-2028	draft	f	8	0	2026-03-19 08:29:25.213147+00	2026-03-19 08:29:25.213147+00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8	2	2026-2027	draft	t	2	0	2026-03-17 14:15:13.495243+00	2026-03-19 08:26:16.339244+00	t	Yêu cầu chỉnh sửa	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
13	1	2028-2029	draft	f	1	0	2026-03-19 08:33:49.734148+00	2026-03-19 08:33:49.734148+00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1	1	2023-2027	published	t	\N	0	2026-03-16 07:51:28.060707+00	2026-03-16 07:51:28.060707+00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4	1	2027-2028	published	t	\N	0	2026-03-17 07:35:21.903959+00	2026-03-17 10:58:04.406075+00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2	2	2025-2026	published	t	\N	0	2026-03-16 08:31:31.01021+00	2026-03-16 08:32:40.240307+00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
16	7	2025-2026	draft	f	\N	0	2026-03-23 08:57:01.276627+00	2026-03-23 08:57:01.276627+00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: programs; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.programs (id, department_id, name, code, degree, total_credits, created_at, name_en, institution, degree_name, training_mode, notes) FROM stdin;
1	653	Kĩ Thuật Phần Mềm	7480201	Đại học	150	2026-03-16 07:51:28.016001+00	\N	\N	\N	\N	\N
7	652	Hệ Thống Thông Tin	468498	Đại học	\N	2026-03-23 08:53:59.456335+00	\N	\N	\N	\N	\N
8	658	Ngành Tiếng Anh thương mại	7220204	Đại học	\N	2026-03-23 08:55:05.024007+00	\N	\N	\N	\N	\N
2	923	Ngôn Ngữ Anh	1234567	Đại học	150	2026-03-16 08:31:14.796819+00	AV	\N	\N	Chính quy	\N
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.role_permissions (role_id, permission_id) FROM stdin;
1	30
1	31
1	29
1	32
1	12
1	1
1	21
1	22
1	23
1	20
2	30
2	31
2	29
2	32
2	2
2	1
2	24
2	28
2	20
3	29
3	32
3	33
3	7
3	3
3	5
3	4
3	10
3	11
3	6
3	2
3	1
3	516
3	514
3	515
3	513
3	512
3	25
3	28
3	21
3	22
3	23
3	20
4	30
4	31
4	29
4	33
4	8
4	3
4	13
4	5
4	4
4	10
4	11
4	12
4	2
4	1
4	516
4	514
4	515
4	513
4	512
4	37
4	26
4	28
4	21
4	22
4	20
5	29
5	9
5	10
5	2
5	1
5	27
5	28
5	20
6	29
6	33
6	13
6	5
6	4
6	12
6	2
6	1
6	516
6	514
6	515
6	513
6	512
6	36
6	35
6	34
6	38
6	37
6	27
6	25
6	26
6	24
6	28
6	21
6	22
6	23
6	20
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.roles (id, code, name, level, is_system) FROM stdin;
1	GIANG_VIEN	Giảng viên	1	t
2	TRUONG_NGANH	Trưởng ngành / Trưởng BM	2	t
3	LANH_DAO_KHOA	Lãnh đạo Khoa/Viện/TT	3	t
4	PHONG_DAO_TAO	Phòng Đào tạo	4	t
5	BAN_GIAM_HIEU	Ban Giám Hiệu	5	t
6	ADMIN	Quản trị hệ thống	99	t
\.


--
-- Data for Name: syllabus_assignments; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.syllabus_assignments (id, syllabus_id, user_id, assigned_at) FROM stdin;
1	1	12	2026-03-24 03:20:29.137096+00
4	10	12	2026-03-24 04:31:52.465363+00
5	9	12	2026-03-24 06:58:52.602634+00
6	8	12	2026-03-24 08:10:24.432959+00
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.user_roles (id, user_id, role_id, department_id) FROM stdin;
1	1	6	1
18	5	4	6
21	4	3	6
30	6	5	5
31	4	3	5
34	3	2	652
39	2	1	651
41	12	1	653
48	11	2	653
58	14	2	651
59	13	1	923
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.users (id, username, password_hash, display_name, email, is_active, created_at, department_id) FROM stdin;
2	giangvien	$2a$10$TgbN5tNqsB.wvYeSPNC2sOmcjtZA5uMLJTE5e8ym/VhLxmdf2nGWG	Giang Viên	giangvien@gmail.com	t	2026-03-16 08:29:03.1614+00	\N
3	truongnganh	$2a$10$58Obnp./ABApxjBH.QTW7utWAHrJVGARpUY0odqCZmwtzWQMwKnR6	Huy	test@gmail.com	t	2026-03-16 16:07:34.613381+00	\N
4	lanhdaokhoa	$2a$10$KjJThaHCPM99hdyS4Cj0BuISnHLrsIyAmjfAkj/.Z3pFU1B3o/F3u	Huy	test@gmail.com	t	2026-03-16 16:08:33.336383+00	\N
5	phongdaotao	$2a$10$IyWrFqwTFrLToN8eSZcVm.63HXvxLKd/XnW6c/aiABUXmtG8KjcSu	Huy	test@gmail.com	t	2026-03-16 16:09:06.938705+00	\N
6	bangiamhieu	$2a$10$K6L33sdAvmIt5BywIgFbwu40RGbdxpy9N36rkBqNWJPEYUhJqpuni	Huy	test@gmail.com	t	2026-03-16 16:09:48.505292+00	\N
13	chinhan	$2a$10$Calzqm8zBPr2PwZwiVimi.V8rjor/zjh/v4wB5XkMNxDtz6CrrYH6	Trưởng Ngành	chinhan@gmail.com	t	2026-03-24 03:46:35.687827+00	\N
11	tn_cntt	$2a$10$83fIl6WTQy2IW.XNwnBfz.sav.S/5nS/a4/zPx4rOVJnMakmSbDG2	Trưởng ngành CNTT	\N	t	2026-03-24 03:18:28.487121+00	5
12	gv_cntt	$2a$10$K7eyynurEU64SjUV3JwSkOQtYB977N.Pt34h8YQBfoxAE4W6P4khq	Giảng viên CNTT	\N	t	2026-03-24 03:18:28.557501+00	5
14	nhan	$2a$10$kVjoVrTt0hkmajapWaf4q.a81p4f1DJ/TPAG2Mco2iNsDbXf.ARom	Giangvien	chin@gmail.com	t	2026-03-24 06:37:17.453294+00	\N
1	admin	$2a$10$EI.5Zm7Ik7I8BoWuNBo2rO2FLB1rWyuNTILkiWbQfNbgYm7/ftzgm	Quản trị viên	\N	t	2026-03-16 07:48:23.631192+00	1
\.


--
-- Data for Name: version_courses; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.version_courses (id, version_id, course_id, semester, course_type) FROM stdin;
1	1	1	1	required
2	1	2	1	required
3	1	3	1	required
4	1	4	1	required
7	7	1	1	required
8	7	2	1	required
9	7	3	1	required
10	7	4	1	required
11	7	1	1	required
13	8	4	1	required
15	11	1	1	required
16	11	2	1	required
17	11	3	1	required
18	11	4	1	required
19	11	1	1	required
21	12	4	1	required
22	13	1	1	required
23	13	2	1	required
24	13	3	1	required
25	13	4	1	required
26	12	1	1	required
\.


--
-- Data for Name: version_objectives; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.version_objectives (id, version_id, code, description) FROM stdin;
1	1	PO1	Có kiến thức cơ bản về toán học, khoa học tự nhiên và xã hội.
2	1	PO2	Có khả năng thiết kế, xây dựng và quản lý các hệ thống phần mềm.
3	1	PO3	Có kỹ năng làm việc nhóm và giao tiếp hiệu quả.
5	7	PO1	Có kiến thức cơ bản về toán học, khoa học tự nhiên và xã hội.
6	7	PO2	Có khả năng thiết kế, xây dựng và quản lý các hệ thống phần mềm.
7	7	PO3	Có kỹ năng làm việc nhóm và giao tiếp hiệu quả.
8	11	PO1	Có kiến thức cơ bản về toán học, khoa học tự nhiên và xã hội.
9	11	PO2	Có khả năng thiết kế, xây dựng và quản lý các hệ thống phần mềm.
10	11	PO3	Có kỹ năng làm việc nhóm và giao tiếp hiệu quả.
11	13	PO1	Có kiến thức cơ bản về toán học, khoa học tự nhiên và xã hội.
12	13	PO2	Có khả năng thiết kế, xây dựng và quản lý các hệ thống phần mềm.
13	13	PO3	Có kỹ năng làm việc nhóm và giao tiếp hiệu quả.
\.


--
-- Data for Name: version_pi_courses; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.version_pi_courses (id, version_id, pi_id, course_id, contribution_level) FROM stdin;
1	13	6	25	3
2	13	6	22	2
3	13	6	23	2
4	13	7	25	3
5	13	7	23	2
6	13	7	24	1
7	13	8	23	2
8	13	8	24	3
9	13	9	23	2
10	13	9	24	3
11	13	10	22	3
12	13	10	23	3
13	13	10	24	2
14	13	11	22	3
15	13	11	24	2
\.


--
-- Data for Name: version_plos; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.version_plos (id, version_id, code, bloom_level, description) FROM stdin;
1	1	PLO1	3	Vận dụng kiến thức toán học và khoa học cơ bản vào giải quyết vấn đề CNTT.
2	1	PLO2	4	Thiết kế hệ thống phần mềm đáp ứng yêu cầu khách hàng.
3	1	PLO3	3	Sử dụng thành thạo các ngôn ngữ lập trình phổ biến.
4	7	PLO1	3	Vận dụng kiến thức toán học và khoa học cơ bản vào giải quyết vấn đề CNTT.
5	7	PLO2	4	Thiết kế hệ thống phần mềm đáp ứng yêu cầu khách hàng.
6	7	PLO3	3	Sử dụng thành thạo các ngôn ngữ lập trình phổ biến.
7	11	PLO1	3	Vận dụng kiến thức toán học và khoa học cơ bản vào giải quyết vấn đề CNTT.
8	11	PLO2	4	Thiết kế hệ thống phần mềm đáp ứng yêu cầu khách hàng.
9	11	PLO3	3	Sử dụng thành thạo các ngôn ngữ lập trình phổ biến.
10	13	PLO1	3	Vận dụng kiến thức toán học và khoa học cơ bản vào giải quyết vấn đề CNTT.
11	13	PLO2	4	Thiết kế hệ thống phần mềm đáp ứng yêu cầu khách hàng.
12	13	PLO3	3	Sử dụng thành thạo các ngôn ngữ lập trình phổ biến.
\.


--
-- Data for Name: version_syllabi; Type: TABLE DATA; Schema: public; Owner: program
--

COPY public.version_syllabi (id, version_id, course_id, author_id, status, content, created_at, updated_at, is_rejected, rejection_reason) FROM stdin;
2	1	1	2	draft	{}	2026-03-16 08:29:41.561885+00	2026-03-16 08:29:41.561885+00	f	\N
4	7	1	2	draft	{}	2026-03-17 14:05:00.139118+00	2026-03-17 14:05:00.139118+00	f	\N
5	8	4	4	draft	{}	2026-03-17 15:33:01.145419+00	2026-03-17 15:33:01.145419+00	f	\N
3	7	4	1	published	{}	2026-03-17 14:05:00.139118+00	2026-03-18 01:56:15.083339+00	f	\N
6	11	1	2	draft	{}	2026-03-18 08:53:00.881962+00	2026-03-18 08:53:00.881962+00	f	\N
7	11	4	1	draft	{}	2026-03-18 08:53:00.881962+00	2026-03-18 08:53:00.881962+00	f	\N
8	12	4	4	draft	{}	2026-03-19 08:29:25.213147+00	2026-03-19 08:29:25.213147+00	f	\N
11	13	2	1	draft	{"grading": [{"clos": "CLO1", "method": "Tham gia lớp", "weight": 10, "component": "Chuyên cần"}, {"clos": "CLO2,CLO3", "method": "Code và báo cáo ngắn", "weight": 20, "component": "Bài tập"}, {"clos": "CLO1,CLO3", "method": "Tự luận", "weight": 20, "component": "Giữa kỳ"}, {"clos": "CLO1,CLO2,CLO3", "method": "Thực hành kết hợp tự luận", "weight": 50, "component": "Cuối kỳ"}], "methods": "Giảng giải kết hợp ví dụ, thực hành cài đặt, bài tập nhóm nhỏ, thảo luận phân tích thuật toán.", "summary": "Học phần cung cấp kiến thức về cấu trúc dữ liệu tuyến tính, phi tuyến và các thuật toán tìm kiếm, sắp xếp, phân tích độ phức tạp.", "schedule": [{"clos": "CLO1,CLO3", "week": 1, "topic": "Độ phức tạp thuật toán", "activities": "Phân tích ví dụ"}, {"clos": "CLO2", "week": 2, "topic": "Danh sách liên kết", "activities": "Cài đặt thao tác cơ bản"}, {"clos": "CLO2", "week": 3, "topic": "Ngăn xếp và hàng đợi", "activities": "Giải bài toán mô phỏng"}, {"clos": "CLO1,CLO2", "week": 4, "topic": "Cây và đồ thị cơ bản", "activities": "Biểu diễn dữ liệu"}, {"clos": "CLO3", "week": 5, "topic": "Thuật toán sắp xếp", "activities": "So sánh hiệu năng"}, {"clos": "CLO2,CLO3", "week": 6, "topic": "Thuật toán tìm kiếm", "activities": "Thực hành cài đặt"}], "resources": "Giáo trình cấu trúc dữ liệu và giải thuật; bộ đề luyện code; slide phân tích thuật toán.", "objectives": "Phân tích được đặc trưng của các cấu trúc dữ liệu và thuật toán cơ bản.\\nLựa chọn và cài đặt cấu trúc dữ liệu phù hợp cho từng bài toán.\\nĐánh giá được hiệu quả của lời giải dựa trên độ phức tạp thời gian và bộ nhớ.", "prerequisites": "IT001"}	2026-03-24 03:23:22.137083+00	2026-03-24 09:07:39.497142+00	f	\N
12	13	3	1	draft	{"grading": [{"clos": "CLO1", "method": "Tham gia lớp", "weight": 10, "component": "Chuyên cần"}, {"clos": "CLO3", "method": "SQL trên máy", "weight": 20, "component": "Bài tập lab"}, {"clos": "CLO1,CLO2", "method": "Tự luận", "weight": 20, "component": "Giữa kỳ"}, {"clos": "CLO2,CLO3", "method": "Thực hành + tự luận", "weight": 50, "component": "Cuối kỳ"}], "methods": "Kết hợp lý thuyết, phân tích tình huống, thực hành trên hệ quản trị CSDL và bài tập dự án nhỏ.", "summary": "Học phần giới thiệu mô hình dữ liệu quan hệ, thiết kế cơ sở dữ liệu, ngôn ngữ SQL và thao tác quản trị dữ liệu cơ bản.", "schedule": [{"clos": "CLO1", "week": 1, "topic": "Tổng quan hệ CSDL", "activities": "Phân tích ví dụ hệ thống"}, {"clos": "CLO2", "week": 2, "topic": "Mô hình ER", "activities": "Xác định thực thể và liên kết"}, {"clos": "CLO2", "week": 3, "topic": "Chuẩn hóa dữ liệu", "activities": "Bài tập chuẩn hóa"}, {"clos": "CLO3", "week": 4, "topic": "SQL truy vấn dữ liệu", "activities": "SELECT, JOIN"}, {"clos": "CLO3", "week": 5, "topic": "SQL cập nhật dữ liệu", "activities": "INSERT, UPDATE, DELETE"}, {"clos": "CLO2,CLO3", "week": 6, "topic": "Thiết kế CSDL cho bài toán quản lý", "activities": "Mini project"}], "resources": "Giáo trình cơ sở dữ liệu; tài liệu thực hành SQL; bộ dữ liệu mẫu.", "objectives": "Giải thích được các khái niệm nền tảng của hệ cơ sở dữ liệu và mô hình quan hệ.\\nThiết kế được lược đồ cơ sở dữ liệu đáp ứng yêu cầu quản lý dữ liệu ở mức cơ bản đến trung bình.\\nSử dụng SQL để tạo bảng, truy vấn, cập nhật và khai thác dữ liệu.", "prerequisites": "IT001"}	2026-03-24 04:34:02.607536+00	2026-03-24 09:07:39.497142+00	f	\N
9	13	4	1	submitted	{"grading": [{"clos": "CLO1", "method": "Tham gia và phát biểu", "weight": 10, "component": "Chuyên cần"}, {"clos": "CLO1,CLO2", "method": "Bài tập tuần", "weight": 20, "component": "Bài tập"}, {"clos": "CLO1,CLO2", "method": "Tự luận", "weight": 20, "component": "Giữa kỳ"}, {"clos": "CLO1,CLO2,CLO3", "method": "Tự luận", "weight": 50, "component": "Cuối kỳ"}], "methods": "Giảng giải, chữa bài tập, thảo luận nhóm nhỏ, luyện tập theo chủ đề.", "summary": "Học phần cung cấp nền tảng toán rời rạc cho sinh viên CNTT gồm logic, tập hợp, quan hệ, đồ thị và phương pháp đếm.", "schedule": [{"clos": "CLO1", "week": 1, "topic": "Logic mệnh đề", "activities": "Lập bảng chân trị"}, {"clos": "CLO1", "week": 2, "topic": "Tập hợp và quan hệ", "activities": "Giải bài tập áp dụng"}, {"clos": "CLO2", "week": 3, "topic": "Phương pháp đếm", "activities": "Bài toán hoán vị, tổ hợp"}, {"clos": "CLO2", "week": 4, "topic": "Đồ thị cơ bản", "activities": "Biểu diễn và phân tích đồ thị"}, {"clos": "CLO3", "week": 5, "topic": "Chứng minh toán học", "activities": "Quy nạp và phản chứng"}], "resources": "Giáo trình toán rời rạc; ngân hàng bài tập; phiếu học tập trên lớp.", "objectives": "Trình bày và vận dụng được các khái niệm logic mệnh đề, tập hợp và quan hệ.\\nGiải được các bài toán đếm, truy hồi và đồ thị cơ bản.\\nRèn luyện tư duy chứng minh và lập luận logic phục vụ các học phần chuyên ngành.", "prerequisites": "Không"}	2026-03-19 08:33:49.734148+00	2026-03-24 09:07:39.497142+00	f	Yêu cầu chỉnh sửa
1	1	4	1	published	{}	2026-03-16 07:57:13.190646+00	2026-03-16 07:57:13.190646+00	f	\N
10	13	1	2	submitted	{"grading": [{"clos": "CLO1", "method": "Điểm danh và tham gia", "weight": 10, "component": "Chuyên cần"}, {"clos": "CLO2,CLO3", "method": "Lập trình cá nhân", "weight": 20, "component": "Bài tập thực hành"}, {"clos": "CLO1,CLO2", "method": "Thực hành trên máy", "weight": 20, "component": "Giữa kỳ"}, {"clos": "CLO2,CLO3", "method": "Bài thi lập trình", "weight": 50, "component": "Cuối kỳ"}], "methods": "Thuyết giảng ngắn, minh họa trực tiếp trên máy, thực hành cá nhân, bài tập theo tuần.", "summary": "Học phần trang bị nền tảng tư duy lập trình, biến, kiểu dữ liệu, cấu trúc điều khiển, hàm và mảng thông qua các bài toán cơ bản.", "schedule": [{"clos": "CLO1", "week": 1, "topic": "Tổng quan lập trình và môi trường phát triển", "activities": "Giới thiệu, cài đặt IDE, bài tập nhập xuất"}, {"clos": "CLO1", "week": 2, "topic": "Biến, kiểu dữ liệu, toán tử", "activities": "Ví dụ và bài tập nhỏ"}, {"clos": "CLO2", "week": 3, "topic": "Cấu trúc rẽ nhánh", "activities": "Giải bài toán điều kiện"}, {"clos": "CLO2", "week": 4, "topic": "Vòng lặp", "activities": "Bài tập mô phỏng và tính toán"}, {"clos": "CLO2", "week": 5, "topic": "Hàm và tham số", "activities": "Thiết kế chương trình theo hàm"}, {"clos": "CLO2,CLO3", "week": 6, "topic": "Mảng một chiều", "activities": "Thực hành xử lý danh sách"}, {"clos": "CLO3", "week": 7, "topic": "Kiểm thử và sửa lỗi", "activities": "Debug trực tiếp"}], "resources": "Giáo trình nhập môn lập trình; tài liệu hướng dẫn thực hành; bộ bài tập tuần.", "objectives": "Trình bày được các khái niệm cơ bản của lập trình và quy trình giải quyết bài toán trên máy tính.\\nViết được chương trình đơn giản bằng ngôn ngữ lập trình bậc cao với cấu trúc rẽ nhánh, lặp và hàm.\\nKiểm thử, phát hiện và sửa lỗi cho chương trình ở mức cơ bản.", "prerequisites": "Không"}	2026-03-19 08:33:49.734148+00	2026-03-24 09:33:01.024809+00	f	Yêu cầu chỉnh sửa
\.


--
-- Name: approval_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.approval_logs_id_seq', 104, true);


--
-- Name: assessment_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.assessment_plans_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 880, true);


--
-- Name: course_clos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.course_clos_id_seq', 13, true);


--
-- Name: courses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.courses_id_seq', 13, true);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.departments_id_seq', 1193, true);


--
-- Name: permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.permissions_id_seq', 2562, true);


--
-- Name: plo_pis_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.plo_pis_id_seq', 11, true);


--
-- Name: program_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.program_versions_id_seq', 16, true);


--
-- Name: programs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.programs_id_seq', 8, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.roles_id_seq', 453, true);


--
-- Name: syllabus_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.syllabus_assignments_id_seq', 6, true);


--
-- Name: user_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.user_roles_id_seq', 59, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.users_id_seq', 14, true);


--
-- Name: version_courses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.version_courses_id_seq', 26, true);


--
-- Name: version_objectives_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.version_objectives_id_seq', 13, true);


--
-- Name: version_pi_courses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.version_pi_courses_id_seq', 15, true);


--
-- Name: version_plos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.version_plos_id_seq', 12, true);


--
-- Name: version_syllabi_id_seq; Type: SEQUENCE SET; Schema: public; Owner: program
--

SELECT pg_catalog.setval('public.version_syllabi_id_seq', 12, true);


--
-- Name: approval_logs approval_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.approval_logs
    ADD CONSTRAINT approval_logs_pkey PRIMARY KEY (id);


--
-- Name: assessment_plans assessment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.assessment_plans
    ADD CONSTRAINT assessment_plans_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: clo_plo_map clo_plo_map_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.clo_plo_map
    ADD CONSTRAINT clo_plo_map_pkey PRIMARY KEY (clo_id, plo_id);


--
-- Name: course_clos course_clos_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.course_clos
    ADD CONSTRAINT course_clos_pkey PRIMARY KEY (id);


--
-- Name: course_plo_map course_plo_map_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.course_plo_map
    ADD CONSTRAINT course_plo_map_pkey PRIMARY KEY (course_id, plo_id);


--
-- Name: courses courses_code_key; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_code_key UNIQUE (code);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: plo_pis plo_pis_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.plo_pis
    ADD CONSTRAINT plo_pis_pkey PRIMARY KEY (id);


--
-- Name: po_plo_map po_plo_map_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.po_plo_map
    ADD CONSTRAINT po_plo_map_pkey PRIMARY KEY (po_id, plo_id);


--
-- Name: program_versions program_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.program_versions
    ADD CONSTRAINT program_versions_pkey PRIMARY KEY (id);


--
-- Name: program_versions program_versions_program_id_academic_year_key; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.program_versions
    ADD CONSTRAINT program_versions_program_id_academic_year_key UNIQUE (program_id, academic_year);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: syllabus_assignments syllabus_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.syllabus_assignments
    ADD CONSTRAINT syllabus_assignments_pkey PRIMARY KEY (id);


--
-- Name: syllabus_assignments syllabus_assignments_syllabus_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.syllabus_assignments
    ADD CONSTRAINT syllabus_assignments_syllabus_id_user_id_key UNIQUE (syllabus_id, user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_department_id_key; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_department_id_key UNIQUE (user_id, role_id, department_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: version_courses version_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_courses
    ADD CONSTRAINT version_courses_pkey PRIMARY KEY (id);


--
-- Name: version_objectives version_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_objectives
    ADD CONSTRAINT version_objectives_pkey PRIMARY KEY (id);


--
-- Name: version_pi_courses version_pi_courses_pi_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_pi_courses
    ADD CONSTRAINT version_pi_courses_pi_id_course_id_key UNIQUE (pi_id, course_id);


--
-- Name: version_pi_courses version_pi_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_pi_courses
    ADD CONSTRAINT version_pi_courses_pkey PRIMARY KEY (id);


--
-- Name: version_plos version_plos_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_plos
    ADD CONSTRAINT version_plos_pkey PRIMARY KEY (id);


--
-- Name: version_syllabi version_syllabi_pkey; Type: CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_syllabi
    ADD CONSTRAINT version_syllabi_pkey PRIMARY KEY (id);


--
-- Name: approval_logs approval_logs_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.approval_logs
    ADD CONSTRAINT approval_logs_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- Name: assessment_plans assessment_plans_pi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.assessment_plans
    ADD CONSTRAINT assessment_plans_pi_id_fkey FOREIGN KEY (pi_id) REFERENCES public.plo_pis(id);


--
-- Name: assessment_plans assessment_plans_plo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.assessment_plans
    ADD CONSTRAINT assessment_plans_plo_id_fkey FOREIGN KEY (plo_id) REFERENCES public.version_plos(id) ON DELETE CASCADE;


--
-- Name: assessment_plans assessment_plans_sample_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.assessment_plans
    ADD CONSTRAINT assessment_plans_sample_course_id_fkey FOREIGN KEY (sample_course_id) REFERENCES public.courses(id);


--
-- Name: assessment_plans assessment_plans_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.assessment_plans
    ADD CONSTRAINT assessment_plans_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.program_versions(id) ON DELETE CASCADE;


--
-- Name: clo_plo_map clo_plo_map_clo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.clo_plo_map
    ADD CONSTRAINT clo_plo_map_clo_id_fkey FOREIGN KEY (clo_id) REFERENCES public.course_clos(id) ON DELETE CASCADE;


--
-- Name: clo_plo_map clo_plo_map_plo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.clo_plo_map
    ADD CONSTRAINT clo_plo_map_plo_id_fkey FOREIGN KEY (plo_id) REFERENCES public.version_plos(id) ON DELETE CASCADE;


--
-- Name: course_clos course_clos_version_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.course_clos
    ADD CONSTRAINT course_clos_version_course_id_fkey FOREIGN KEY (version_course_id) REFERENCES public.version_courses(id) ON DELETE CASCADE;


--
-- Name: course_plo_map course_plo_map_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.course_plo_map
    ADD CONSTRAINT course_plo_map_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.version_courses(id) ON DELETE CASCADE;


--
-- Name: course_plo_map course_plo_map_plo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.course_plo_map
    ADD CONSTRAINT course_plo_map_plo_id_fkey FOREIGN KEY (plo_id) REFERENCES public.version_plos(id) ON DELETE CASCADE;


--
-- Name: course_plo_map course_plo_map_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.course_plo_map
    ADD CONSTRAINT course_plo_map_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.program_versions(id) ON DELETE CASCADE;


--
-- Name: courses courses_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id);


--
-- Name: plo_pis plo_pis_plo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.plo_pis
    ADD CONSTRAINT plo_pis_plo_id_fkey FOREIGN KEY (plo_id) REFERENCES public.version_plos(id) ON DELETE CASCADE;


--
-- Name: po_plo_map po_plo_map_plo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.po_plo_map
    ADD CONSTRAINT po_plo_map_plo_id_fkey FOREIGN KEY (plo_id) REFERENCES public.version_plos(id) ON DELETE CASCADE;


--
-- Name: po_plo_map po_plo_map_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.po_plo_map
    ADD CONSTRAINT po_plo_map_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.version_objectives(id) ON DELETE CASCADE;


--
-- Name: po_plo_map po_plo_map_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.po_plo_map
    ADD CONSTRAINT po_plo_map_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.program_versions(id) ON DELETE CASCADE;


--
-- Name: program_versions program_versions_copied_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.program_versions
    ADD CONSTRAINT program_versions_copied_from_id_fkey FOREIGN KEY (copied_from_id) REFERENCES public.program_versions(id);


--
-- Name: program_versions program_versions_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.program_versions
    ADD CONSTRAINT program_versions_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: programs programs_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: syllabus_assignments syllabus_assignments_syllabus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.syllabus_assignments
    ADD CONSTRAINT syllabus_assignments_syllabus_id_fkey FOREIGN KEY (syllabus_id) REFERENCES public.version_syllabi(id) ON DELETE CASCADE;


--
-- Name: syllabus_assignments syllabus_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.syllabus_assignments
    ADD CONSTRAINT syllabus_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: version_courses version_courses_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_courses
    ADD CONSTRAINT version_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: version_courses version_courses_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_courses
    ADD CONSTRAINT version_courses_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.program_versions(id) ON DELETE CASCADE;


--
-- Name: version_objectives version_objectives_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_objectives
    ADD CONSTRAINT version_objectives_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.program_versions(id) ON DELETE CASCADE;


--
-- Name: version_pi_courses version_pi_courses_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_pi_courses
    ADD CONSTRAINT version_pi_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.version_courses(id) ON DELETE CASCADE;


--
-- Name: version_pi_courses version_pi_courses_pi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_pi_courses
    ADD CONSTRAINT version_pi_courses_pi_id_fkey FOREIGN KEY (pi_id) REFERENCES public.plo_pis(id) ON DELETE CASCADE;


--
-- Name: version_pi_courses version_pi_courses_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_pi_courses
    ADD CONSTRAINT version_pi_courses_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.program_versions(id) ON DELETE CASCADE;


--
-- Name: version_plos version_plos_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_plos
    ADD CONSTRAINT version_plos_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.program_versions(id) ON DELETE CASCADE;


--
-- Name: version_syllabi version_syllabi_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_syllabi
    ADD CONSTRAINT version_syllabi_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: version_syllabi version_syllabi_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_syllabi
    ADD CONSTRAINT version_syllabi_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: version_syllabi version_syllabi_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: program
--

ALTER TABLE ONLY public.version_syllabi
    ADD CONSTRAINT version_syllabi_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.program_versions(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: program
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict 8qLqS24cIZZwLYK0097rtpe1BzTcGxSg4Q6GwUVxcqbSvhwxjN5mLpzs0NtgCZD

