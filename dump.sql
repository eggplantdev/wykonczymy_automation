--
-- PostgreSQL database dump
--

\restrict 6XpvuZPBkUxBtaNouML5foggZsVUPQXm0w7ag5RE4CwgfRcKVRSvcbTW386Lyjx

-- Dumped from database version 17.8 (6108b59)
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public.users_sessions DROP CONSTRAINT users_sessions_parent_id_fk;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_default_cash_register_id_cash_registers_id_fk;
ALTER TABLE ONLY public.transactions DROP CONSTRAINT transactions_worker_id_users_id_fk;
ALTER TABLE ONLY public.transactions DROP CONSTRAINT transactions_target_register_id_cash_registers_id_fk;
ALTER TABLE ONLY public.transactions DROP CONSTRAINT transactions_other_category_id_other_categories_id_fk;
ALTER TABLE ONLY public.transactions DROP CONSTRAINT transactions_invoice_id_media_id_fk;
ALTER TABLE ONLY public.transactions DROP CONSTRAINT transactions_investment_id_investments_id_fk;
ALTER TABLE ONLY public.transactions DROP CONSTRAINT transactions_created_by_id_users_id_fk;
ALTER TABLE ONLY public.transactions DROP CONSTRAINT transactions_cash_register_id_cash_registers_id_fk;
ALTER TABLE ONLY public.transactions DROP CONSTRAINT transactions_cancelled_transaction_id_fkey;
ALTER TABLE ONLY public.payload_preferences_rels DROP CONSTRAINT payload_preferences_rels_users_fk;
ALTER TABLE ONLY public.payload_preferences_rels DROP CONSTRAINT payload_preferences_rels_parent_fk;
ALTER TABLE ONLY public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_users_fk;
ALTER TABLE ONLY public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_transactions_fk;
ALTER TABLE ONLY public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_parent_fk;
ALTER TABLE ONLY public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_other_categories_fk;
ALTER TABLE ONLY public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_media_fk;
ALTER TABLE ONLY public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_investments_fk;
ALTER TABLE ONLY public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_cash_registers_fk;
ALTER TABLE ONLY public.media DROP CONSTRAINT media_created_by_id_users_id_fk;
ALTER TABLE ONLY public.cash_registers DROP CONSTRAINT cash_registers_owner_id_users_id_fk;
ALTER TABLE ONLY neon_auth.session DROP CONSTRAINT "session_userId_fkey";
ALTER TABLE ONLY neon_auth.member DROP CONSTRAINT "member_userId_fkey";
ALTER TABLE ONLY neon_auth.member DROP CONSTRAINT "member_organizationId_fkey";
ALTER TABLE ONLY neon_auth.invitation DROP CONSTRAINT "invitation_organizationId_fkey";
ALTER TABLE ONLY neon_auth.invitation DROP CONSTRAINT "invitation_inviterId_fkey";
ALTER TABLE ONLY neon_auth.account DROP CONSTRAINT "account_userId_fkey";
DROP INDEX public.users_updated_at_idx;
DROP INDEX public.users_sessions_parent_id_idx;
DROP INDEX public.users_sessions_order_idx;
DROP INDEX public.users_email_idx;
DROP INDEX public.users_default_cash_register_idx;
DROP INDEX public.users_created_at_idx;
DROP INDEX public.transactions_worker_idx;
DROP INDEX public.transactions_updated_at_idx;
DROP INDEX public.transactions_target_register_idx;
DROP INDEX public.transactions_source_register_idx;
DROP INDEX public.transactions_other_category_idx;
DROP INDEX public.transactions_invoice_idx;
DROP INDEX public.transactions_investment_idx;
DROP INDEX public.transactions_created_by_idx;
DROP INDEX public.transactions_created_at_idx;
DROP INDEX public.payload_preferences_updated_at_idx;
DROP INDEX public.payload_preferences_rels_users_id_idx;
DROP INDEX public.payload_preferences_rels_path_idx;
DROP INDEX public.payload_preferences_rels_parent_idx;
DROP INDEX public.payload_preferences_rels_order_idx;
DROP INDEX public.payload_preferences_key_idx;
DROP INDEX public.payload_preferences_created_at_idx;
DROP INDEX public.payload_migrations_updated_at_idx;
DROP INDEX public.payload_migrations_created_at_idx;
DROP INDEX public.payload_locked_documents_updated_at_idx;
DROP INDEX public.payload_locked_documents_rels_users_id_idx;
DROP INDEX public.payload_locked_documents_rels_transactions_id_idx;
DROP INDEX public.payload_locked_documents_rels_path_idx;
DROP INDEX public.payload_locked_documents_rels_parent_idx;
DROP INDEX public.payload_locked_documents_rels_other_categories_id_idx;
DROP INDEX public.payload_locked_documents_rels_order_idx;
DROP INDEX public.payload_locked_documents_rels_media_id_idx;
DROP INDEX public.payload_locked_documents_rels_investments_id_idx;
DROP INDEX public.payload_locked_documents_rels_cash_registers_id_idx;
DROP INDEX public.payload_locked_documents_global_slug_idx;
DROP INDEX public.payload_locked_documents_created_at_idx;
DROP INDEX public.payload_kv_key_idx;
DROP INDEX public.other_categories_updated_at_idx;
DROP INDEX public.other_categories_name_idx;
DROP INDEX public.other_categories_created_at_idx;
DROP INDEX public.media_updated_at_idx;
DROP INDEX public.media_sizes_thumbnail_sizes_thumbnail_filename_idx;
DROP INDEX public.media_filename_idx;
DROP INDEX public.media_created_by_idx;
DROP INDEX public.media_created_at_idx;
DROP INDEX public.investments_updated_at_idx;
DROP INDEX public.investments_created_at_idx;
DROP INDEX public.idx_transactions_worker_type;
DROP INDEX public.idx_transactions_date;
DROP INDEX public.idx_transactions_cancelled_tx;
DROP INDEX public.idx_transactions_cancelled;
DROP INDEX public.cash_registers_updated_at_idx;
DROP INDEX public.cash_registers_owner_idx;
DROP INDEX public.cash_registers_created_at_idx;
DROP INDEX neon_auth.verification_identifier_idx;
DROP INDEX neon_auth."session_userId_idx";
DROP INDEX neon_auth.organization_slug_uidx;
DROP INDEX neon_auth."member_userId_idx";
DROP INDEX neon_auth."member_organizationId_idx";
DROP INDEX neon_auth."invitation_organizationId_idx";
DROP INDEX neon_auth.invitation_email_idx;
DROP INDEX neon_auth."account_userId_idx";
ALTER TABLE ONLY public.users_sessions DROP CONSTRAINT users_sessions_pkey;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
ALTER TABLE ONLY public.transactions DROP CONSTRAINT transactions_pkey;
ALTER TABLE ONLY public.payload_preferences_rels DROP CONSTRAINT payload_preferences_rels_pkey;
ALTER TABLE ONLY public.payload_preferences DROP CONSTRAINT payload_preferences_pkey;
ALTER TABLE ONLY public.payload_migrations DROP CONSTRAINT payload_migrations_pkey;
ALTER TABLE ONLY public.payload_locked_documents_rels DROP CONSTRAINT payload_locked_documents_rels_pkey;
ALTER TABLE ONLY public.payload_locked_documents DROP CONSTRAINT payload_locked_documents_pkey;
ALTER TABLE ONLY public.payload_kv DROP CONSTRAINT payload_kv_pkey;
ALTER TABLE ONLY public.other_categories DROP CONSTRAINT other_categories_pkey;
ALTER TABLE ONLY public.media DROP CONSTRAINT media_pkey;
ALTER TABLE ONLY public.investments DROP CONSTRAINT investments_pkey;
ALTER TABLE ONLY public.cash_registers DROP CONSTRAINT cash_registers_pkey;
ALTER TABLE ONLY neon_auth.verification DROP CONSTRAINT verification_pkey;
ALTER TABLE ONLY neon_auth."user" DROP CONSTRAINT user_pkey;
ALTER TABLE ONLY neon_auth."user" DROP CONSTRAINT user_email_key;
ALTER TABLE ONLY neon_auth.session DROP CONSTRAINT session_token_key;
ALTER TABLE ONLY neon_auth.session DROP CONSTRAINT session_pkey;
ALTER TABLE ONLY neon_auth.project_config DROP CONSTRAINT project_config_pkey;
ALTER TABLE ONLY neon_auth.project_config DROP CONSTRAINT project_config_endpoint_id_key;
ALTER TABLE ONLY neon_auth.organization DROP CONSTRAINT organization_slug_key;
ALTER TABLE ONLY neon_auth.organization DROP CONSTRAINT organization_pkey;
ALTER TABLE ONLY neon_auth.member DROP CONSTRAINT member_pkey;
ALTER TABLE ONLY neon_auth.jwks DROP CONSTRAINT jwks_pkey;
ALTER TABLE ONLY neon_auth.invitation DROP CONSTRAINT invitation_pkey;
ALTER TABLE ONLY neon_auth.account DROP CONSTRAINT account_pkey;
ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.payload_preferences_rels ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.payload_preferences ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.payload_migrations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.payload_locked_documents_rels ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.payload_locked_documents ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.payload_kv ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.other_categories ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.media ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.investments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.cash_registers ALTER COLUMN id DROP DEFAULT;
DROP TABLE public.users_sessions;
DROP SEQUENCE public.users_id_seq;
DROP TABLE public.users;
DROP SEQUENCE public.transactions_id_seq;
DROP TABLE public.transactions;
DROP SEQUENCE public.payload_preferences_rels_id_seq;
DROP TABLE public.payload_preferences_rels;
DROP SEQUENCE public.payload_preferences_id_seq;
DROP TABLE public.payload_preferences;
DROP SEQUENCE public.payload_migrations_id_seq;
DROP TABLE public.payload_migrations;
DROP SEQUENCE public.payload_locked_documents_rels_id_seq;
DROP TABLE public.payload_locked_documents_rels;
DROP SEQUENCE public.payload_locked_documents_id_seq;
DROP TABLE public.payload_locked_documents;
DROP SEQUENCE public.payload_kv_id_seq;
DROP TABLE public.payload_kv;
DROP SEQUENCE public.other_categories_id_seq;
DROP TABLE public.other_categories;
DROP SEQUENCE public.media_id_seq;
DROP TABLE public.media;
DROP SEQUENCE public.investments_id_seq;
DROP TABLE public.investments;
DROP SEQUENCE public.cash_registers_id_seq;
DROP TABLE public.cash_registers;
DROP TABLE neon_auth.verification;
DROP TABLE neon_auth."user";
DROP TABLE neon_auth.session;
DROP TABLE neon_auth.project_config;
DROP TABLE neon_auth.organization;
DROP TABLE neon_auth.member;
DROP TABLE neon_auth.jwks;
DROP TABLE neon_auth.invitation;
DROP TABLE neon_auth.account;
DROP TYPE public.enum_users_role;
DROP TYPE public.enum_transactions_type;
DROP TYPE public.enum_transactions_payment_method;
DROP TYPE public.enum_investments_status;
DROP TYPE public.enum_cash_registers_type;
DROP SCHEMA neon_auth;
--
-- Name: neon_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA neon_auth;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: enum_cash_registers_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_cash_registers_type AS ENUM (
    'MAIN',
    'AUXILIARY',
    'VIRTUAL'
);


--
-- Name: enum_investments_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_investments_status AS ENUM (
    'active',
    'completed'
);


--
-- Name: enum_transactions_payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_transactions_payment_method AS ENUM (
    'CASH',
    'BLIK',
    'TRANSFER',
    'CARD'
);


--
-- Name: enum_transactions_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_transactions_type AS ENUM (
    'INVESTOR_DEPOSIT',
    'COMPANY_FUNDING',
    'OTHER_DEPOSIT',
    'INVESTMENT_EXPENSE',
    'ACCOUNT_FUNDING',
    'EMPLOYEE_EXPENSE',
    'REGISTER_TRANSFER',
    'PAYOUT',
    'OTHER',
    'CANCELLATION'
);


--
-- Name: enum_users_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_users_role AS ENUM (
    'ADMIN',
    'OWNER',
    'MANAGER',
    'EMPLOYEE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: invitation; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "inviterId" uuid NOT NULL
);


--
-- Name: jwks; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.jwks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "publicKey" text NOT NULL,
    "privateKey" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "expiresAt" timestamp with time zone
);


--
-- Name: member; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


--
-- Name: organization; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "createdAt" timestamp with time zone NOT NULL,
    metadata text
);


--
-- Name: project_config; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.project_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    endpoint_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    trusted_origins jsonb NOT NULL,
    social_providers jsonb NOT NULL,
    email_provider jsonb,
    email_and_password jsonb,
    allow_localhost boolean NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid NOT NULL,
    "impersonatedBy" text,
    "activeOrganizationId" text
);


--
-- Name: user; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text,
    banned boolean,
    "banReason" text,
    "banExpires" timestamp with time zone
);


--
-- Name: verification; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cash_registers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_registers (
    id integer NOT NULL,
    name character varying NOT NULL,
    owner_id integer NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    type public.enum_cash_registers_type DEFAULT 'AUXILIARY'::public.enum_cash_registers_type NOT NULL,
    active boolean DEFAULT true
);


--
-- Name: cash_registers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_registers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_registers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_registers_id_seq OWNED BY public.cash_registers.id;


--
-- Name: investments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investments (
    id integer NOT NULL,
    name character varying NOT NULL,
    address character varying,
    phone character varying,
    email character varying,
    contact_person character varying,
    notes character varying,
    status public.enum_investments_status DEFAULT 'active'::public.enum_investments_status NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    labor_costs numeric DEFAULT 0 NOT NULL
);


--
-- Name: investments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.investments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: investments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.investments_id_seq OWNED BY public.investments.id;


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id integer NOT NULL,
    alt character varying,
    created_by_id integer,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    url character varying,
    thumbnail_u_r_l character varying,
    filename character varying,
    mime_type character varying,
    filesize numeric,
    width numeric,
    height numeric,
    focal_x numeric,
    focal_y numeric,
    sizes_thumbnail_url character varying,
    sizes_thumbnail_width numeric,
    sizes_thumbnail_height numeric,
    sizes_thumbnail_mime_type character varying,
    sizes_thumbnail_filesize numeric,
    sizes_thumbnail_filename character varying
);


--
-- Name: media_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;


--
-- Name: other_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.other_categories (
    id integer NOT NULL,
    name character varying NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: other_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.other_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: other_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.other_categories_id_seq OWNED BY public.other_categories.id;


--
-- Name: payload_kv; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payload_kv (
    id integer NOT NULL,
    key character varying NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: payload_kv_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payload_kv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payload_kv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payload_kv_id_seq OWNED BY public.payload_kv.id;


--
-- Name: payload_locked_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payload_locked_documents (
    id integer NOT NULL,
    global_slug character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: payload_locked_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payload_locked_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payload_locked_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payload_locked_documents_id_seq OWNED BY public.payload_locked_documents.id;


--
-- Name: payload_locked_documents_rels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payload_locked_documents_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    users_id integer,
    cash_registers_id integer,
    investments_id integer,
    other_categories_id integer,
    media_id integer,
    transactions_id integer
);


--
-- Name: payload_locked_documents_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payload_locked_documents_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payload_locked_documents_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payload_locked_documents_rels_id_seq OWNED BY public.payload_locked_documents_rels.id;


--
-- Name: payload_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payload_migrations (
    id integer NOT NULL,
    name character varying,
    batch numeric,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: payload_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payload_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payload_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payload_migrations_id_seq OWNED BY public.payload_migrations.id;


--
-- Name: payload_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payload_preferences (
    id integer NOT NULL,
    key character varying,
    value jsonb,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: payload_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payload_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payload_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payload_preferences_id_seq OWNED BY public.payload_preferences.id;


--
-- Name: payload_preferences_rels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payload_preferences_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    users_id integer
);


--
-- Name: payload_preferences_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payload_preferences_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payload_preferences_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payload_preferences_rels_id_seq OWNED BY public.payload_preferences_rels.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    description character varying NOT NULL,
    amount numeric NOT NULL,
    date timestamp(3) with time zone NOT NULL,
    type public.enum_transactions_type NOT NULL,
    payment_method public.enum_transactions_payment_method NOT NULL,
    source_register_id integer,
    investment_id integer,
    worker_id integer,
    other_category_id integer,
    other_description character varying,
    invoice_id integer,
    invoice_note character varying,
    created_by_id integer,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    target_register_id integer,
    cancelled boolean DEFAULT false,
    cancelled_transaction_id integer
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    email character varying NOT NULL,
    reset_password_token character varying,
    reset_password_expiration timestamp(3) with time zone,
    salt character varying,
    hash character varying,
    login_attempts numeric DEFAULT 0,
    lock_until timestamp(3) with time zone,
    role public.enum_users_role DEFAULT 'EMPLOYEE'::public.enum_users_role NOT NULL,
    active boolean DEFAULT true,
    default_cash_register_id integer
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: users_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_sessions (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    created_at timestamp(3) with time zone,
    expires_at timestamp(3) with time zone NOT NULL
);


--
-- Name: cash_registers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_registers ALTER COLUMN id SET DEFAULT nextval('public.cash_registers_id_seq'::regclass);


--
-- Name: investments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments ALTER COLUMN id SET DEFAULT nextval('public.investments_id_seq'::regclass);


--
-- Name: media id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media ALTER COLUMN id SET DEFAULT nextval('public.media_id_seq'::regclass);


--
-- Name: other_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.other_categories ALTER COLUMN id SET DEFAULT nextval('public.other_categories_id_seq'::regclass);


--
-- Name: payload_kv id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_kv ALTER COLUMN id SET DEFAULT nextval('public.payload_kv_id_seq'::regclass);


--
-- Name: payload_locked_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents ALTER COLUMN id SET DEFAULT nextval('public.payload_locked_documents_id_seq'::regclass);


--
-- Name: payload_locked_documents_rels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents_rels ALTER COLUMN id SET DEFAULT nextval('public.payload_locked_documents_rels_id_seq'::regclass);


--
-- Name: payload_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_migrations ALTER COLUMN id SET DEFAULT nextval('public.payload_migrations_id_seq'::regclass);


--
-- Name: payload_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_preferences ALTER COLUMN id SET DEFAULT nextval('public.payload_preferences_id_seq'::regclass);


--
-- Name: payload_preferences_rels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_preferences_rels ALTER COLUMN id SET DEFAULT nextval('public.payload_preferences_rels_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: account; Type: TABLE DATA; Schema: neon_auth; Owner: -
--

COPY neon_auth.account (id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", scope, password, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: invitation; Type: TABLE DATA; Schema: neon_auth; Owner: -
--

COPY neon_auth.invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId") FROM stdin;
\.


--
-- Data for Name: jwks; Type: TABLE DATA; Schema: neon_auth; Owner: -
--

COPY neon_auth.jwks (id, "publicKey", "privateKey", "createdAt", "expiresAt") FROM stdin;
\.


--
-- Data for Name: member; Type: TABLE DATA; Schema: neon_auth; Owner: -
--

COPY neon_auth.member (id, "organizationId", "userId", role, "createdAt") FROM stdin;
\.


--
-- Data for Name: organization; Type: TABLE DATA; Schema: neon_auth; Owner: -
--

COPY neon_auth.organization (id, name, slug, logo, "createdAt", metadata) FROM stdin;
\.


--
-- Data for Name: project_config; Type: TABLE DATA; Schema: neon_auth; Owner: -
--

COPY neon_auth.project_config (id, name, endpoint_id, created_at, updated_at, trusted_origins, social_providers, email_provider, email_and_password, allow_localhost) FROM stdin;
0f25d31c-b036-4243-9570-0c80314611d4	wykonczymy	ep-steep-unit-agsa64dd	2026-02-14 15:14:55.005+00	2026-02-14 15:14:55.005+00	[]	[{"id": "google", "isShared": true}]	{"type": "shared"}	{"enabled": true, "disableSignUp": false, "emailVerificationMethod": "otp", "requireEmailVerification": false, "autoSignInAfterVerification": true, "sendVerificationEmailOnSignIn": false, "sendVerificationEmailOnSignUp": false}	t
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: neon_auth; Owner: -
--

COPY neon_auth.session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId", "impersonatedBy", "activeOrganizationId") FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: neon_auth; Owner: -
--

COPY neon_auth."user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt", role, banned, "banReason", "banExpires") FROM stdin;
\.


--
-- Data for Name: verification; Type: TABLE DATA; Schema: neon_auth; Owner: -
--

COPY neon_auth.verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: cash_registers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cash_registers (id, name, owner_id, updated_at, created_at, type, active) FROM stdin;
10	Yuri Kasa gotówka	18	2026-02-21 16:04:47.768+00	2026-02-19 21:02:53.027+00	AUXILIARY	t
5	Kasa główna Bartek	16	2026-02-21 17:46:50.587+00	2026-02-19 19:35:49.113+00	MAIN	t
7	Kasa Adrian Gotówka	17	2026-02-22 19:38:51.019+00	2026-02-19 20:52:02.669+00	AUXILIARY	f
9	Kasa Adrian konto główne	17	2026-02-22 19:38:52.287+00	2026-02-19 21:01:32.598+00	AUXILIARY	f
8	Kasa Adrian konto pomocnicze firmowe 	17	2026-02-22 19:38:53.472+00	2026-02-19 20:55:56.86+00	AUXILIARY	f
6	Kasa pomocnicza Bartek	16	2026-02-22 19:38:54.623+00	2026-02-19 19:36:11.116+00	AUXILIARY	f
11	Telmak	16	2026-02-22 19:38:55.772+00	2026-02-22 13:55:15.699+00	VIRTUAL	f
\.


--
-- Data for Name: investments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.investments (id, name, address, phone, email, contact_person, notes, status, updated_at, created_at, labor_costs) FROM stdin;
18	Łomianki Staszica 20a/3	Łomianki Staszica 20a/3	537 042 276‬	\N	\N	\N	active	2026-02-20 11:37:16.608+00	2026-02-20 11:37:16.608+00	0
19	Siennicka 50/152 	Siennicka 50/152 	602 593 833‬	\N	\N	\N	active	2026-02-20 11:37:55.998+00	2026-02-20 11:37:55.997+00	0
10	Żupnicza 10/83	Żupnicza 10/83	573 013 199	\N	\N	\N	active	2026-02-21 16:08:43.632+00	2026-02-20 11:19:36.471+00	0
12	Sierakowskiego 3/81	Sierakowskiego 3/81	515 372 268	\N	\N	\N	active	2026-02-21 16:09:32.113+00	2026-02-20 11:20:52.239+00	0
14	Wołoska 3/302	Wołoska 3/302	533 514 501	\N	\N	\N	active	2026-02-21 16:19:06.964+00	2026-02-20 11:24:03.841+00	0
6	Apenińska 2/37 - Adam Orłowski	Apenińska 2/37 	+48 532 088 486	boguszewski.bartlomiej1@gmail.com	\N	\N	completed	2026-02-22 15:03:01.568+00	2026-02-19 22:27:06.764+00	0
20	Budrysow 11/13  m11	Budrysow 11/13  m11	577 073 822‬	\N	\N	\N	completed	2026-02-22 15:03:04.489+00	2026-02-20 11:38:36.31+00	0
8	Chłodna 22/6	Chłodna 22/6	602 715 376 	wbrewka@interia.pl	\N	\N	completed	2026-02-22 15:03:05.617+00	2026-02-20 11:17:23.225+00	0
11	Grochowska 207/104	Grochowska 207/104	600 722 533	\N	\N	\N	completed	2026-02-22 15:03:06.743+00	2026-02-20 11:20:13.059+00	0
17	Iławska 4/57	Iławska 4/57	663 687 460‬	\N	\N	\N	completed	2026-02-22 15:03:06.873+00	2026-02-20 11:35:38.257+00	0
13	Bałuckiego 27/10	Bałuckiego 27/10	793 622 743	\N	\N	\N	completed	2026-02-22 15:03:06.912+00	2026-02-20 11:23:36.541+00	0
21	Kiwi 8/46  	Kiwi 8/46  	730 611 869‬	\N	\N	\N	completed	2026-02-22 15:03:07.716+00	2026-02-20 11:39:54.851+00	0
15	Koprowskiego 6e/6	Koprowskiego 6e/6	791 435 644	\N	\N	\N	completed	2026-02-22 15:31:44.333+00	2026-02-20 11:26:01.866+00	0
7	Madalinskiego 67 	Madalinskiego 67/31	\N	\N	504 682 208	\N	completed	2026-02-22 15:31:47.226+00	2026-02-20 11:15:32.611+00	0
22	Równoległa 8/61	Równoległa 8/61	‪+44 7598 023111‬	\N	\N	\N	completed	2026-02-22 15:31:57.935+00	2026-02-20 11:40:49.472+00	0
16	Międzynarodowa 47/36	Międzynarodowa 47/36	571 324 069	\N	\N	\N	completed	2026-02-22 15:32:11.012+00	2026-02-20 11:29:04.131+00	0
9	Al. Rzeczypospolitej 21/25	Al. Rzeczypospolitej 21/25	696 457 782	\N	\N	\N	active	2026-02-22 15:49:51.306+00	2026-02-20 11:18:42.048+00	0
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.media (id, alt, created_by_id, updated_at, created_at, url, thumbnail_u_r_l, filename, mime_type, filesize, width, height, focal_x, focal_y, sizes_thumbnail_url, sizes_thumbnail_width, sizes_thumbnail_height, sizes_thumbnail_mime_type, sizes_thumbnail_filesize, sizes_thumbnail_filename) FROM stdin;
\.


--
-- Data for Name: other_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.other_categories (id, name, updated_at, created_at) FROM stdin;
5	paliwo	2026-02-20 19:26:34.122+00	2026-02-20 19:26:34.121+00
6	inne	2026-02-20 19:26:52.009+00	2026-02-20 19:26:52.008+00
7	zaliczka na poczet wypłaty	2026-02-20 19:27:21.501+00	2026-02-20 19:27:21.501+00
8	transport	2026-02-20 19:27:58.401+00	2026-02-20 19:27:58.401+00
\.


--
-- Data for Name: payload_kv; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payload_kv (id, key, data) FROM stdin;
\.


--
-- Data for Name: payload_locked_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payload_locked_documents (id, global_slug, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: payload_locked_documents_rels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payload_locked_documents_rels (id, "order", parent_id, path, users_id, cash_registers_id, investments_id, other_categories_id, media_id, transactions_id) FROM stdin;
\.


--
-- Data for Name: payload_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payload_migrations (id, name, batch, updated_at, created_at) FROM stdin;
1	20260211_202001	1	2026-02-12 09:17:10.633+00	2026-02-12 09:17:10.63+00
2	20260211_204911_add_user_role	1	2026-02-12 09:17:10.666+00	2026-02-12 09:17:10.666+00
3	20260211_212425	1	2026-02-12 09:17:10.714+00	2026-02-12 09:17:10.714+00
4	20260211_213603	1	2026-02-12 09:17:10.748+00	2026-02-12 09:17:10.747+00
5	20260212_191046_add_deposit_type	2	2026-02-12 19:11:07.026+00	2026-02-12 19:11:07.025+00
6	20260216_add_performance_indexes	3	2026-02-16 21:57:00.138+00	2026-02-16 21:57:00.137+00
7	20260218_rename_advance_to_account_funding	4	2026-02-18 16:32:29.827+00	2026-02-18 16:32:29.826+00
8	20260218_0_transaction_type_enums	5	2026-02-18 17:09:42.729+00	2026-02-18 17:09:42.728+00
9	20260218_transaction_type_overhaul	5	2026-02-18 17:09:43.11+00	2026-02-18 17:09:43.11+00
10	20260218_add_cash_register_type	6	2026-02-18 20:09:40.629+00	2026-02-18 20:09:40.628+00
11	20260218_add_investment_financials	6	2026-02-18 20:41:45.779+00	2026-02-18 20:41:45.778+00
12	20260218_seed_other_category_inne	6	2026-02-18 20:41:45.984+00	2026-02-18 20:41:45.984+00
13	20260219_192300_add_active_field_to_users	6	2026-02-19 19:23:25.289+00	2026-02-19 19:23:25.287+00
14	20260220_add_active_field_to_cash_registers	7	2026-02-20 20:38:22.033+00	2026-02-20 20:38:22.032+00
15	20260221_193257	8	2026-02-22 10:06:11.927+00	2026-02-22 10:06:11.926+00
16	20260221_200518	8	2026-02-22 10:06:12.511+00	2026-02-22 10:06:12.511+00
17	20260221_201040	8	2026-02-22 10:06:12.994+00	2026-02-22 10:06:12.994+00
18	20260221_201112	8	2026-02-22 10:06:13.489+00	2026-02-22 10:06:13.489+00
19	20260221_add_virtual_cash_register_type	8	2026-02-22 10:06:13.984+00	2026-02-22 10:06:13.984+00
20	20260222_rename_cash_register_to_source_register	8	2026-02-22 10:06:14.464+00	2026-02-22 10:06:14.464+00
21	20260222_0_add_cancellation_enum	9	2026-02-22 11:54:32.645+00	2026-02-22 11:54:32.644+00
22	20260222_1_add_cancellation_columns	9	2026-02-22 11:54:33.217+00	2026-02-22 11:54:33.217+00
23	20260222_drop_materialized_columns	9	2026-02-22 13:49:35.079+00	2026-02-22 13:49:35.078+00
\.


--
-- Data for Name: payload_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payload_preferences (id, key, value, updated_at, created_at) FROM stdin;
17	collection-users	{"limit": 10}	2026-02-19 19:32:02.985+00	2026-02-19 19:32:02.983+00
18	collection-other-categories	{}	2026-02-19 19:33:16.085+00	2026-02-19 19:33:16.083+00
19	collection-cash-registers	{"editViewType": "default"}	2026-02-19 19:35:32.811+00	2026-02-19 19:35:29.665+00
20	collection-cash-registers	{"limit": 10}	2026-02-19 19:40:11.823+00	2026-02-19 19:35:29.681+00
16	collection-users	{"limit": 10, "editViewType": "default"}	2026-02-19 20:50:28.601+00	2026-02-19 19:32:02.988+00
15	collection-users	{"limit": 10, "editViewType": "default"}	2026-02-19 21:02:40.526+00	2026-02-19 19:29:42.952+00
22	collection-cash-registers	{}	2026-02-19 21:03:21.185+00	2026-02-19 21:03:21.184+00
23	collection-cash-registers	{}	2026-02-19 21:03:21.371+00	2026-02-19 21:03:21.371+00
26	collection-cash-registers	{"limit": 10, "editViewType": "default"}	2026-02-19 22:24:03.21+00	2026-02-19 22:21:34.265+00
27	nav	{"groups": {"Administracja": {"open": true}}}	2026-02-19 22:24:44.259+00	2026-02-19 22:24:43.865+00
28	collection-other-categories	{}	2026-02-19 22:25:01.435+00	2026-02-19 22:25:01.435+00
29	collection-investments	{"editViewType": "default"}	2026-02-19 22:27:24.995+00	2026-02-19 22:25:03.966+00
31	collection-media	{}	2026-02-20 11:30:01.793+00	2026-02-20 11:30:01.792+00
32	collection-media	{}	2026-02-20 11:30:01.997+00	2026-02-20 11:30:01.997+00
30	collection-investments	{"limit": 10}	2026-02-20 11:41:17.539+00	2026-02-19 22:25:04.166+00
25	collection-users	{"sort": "-role", "limit": 10, "editViewType": "default"}	2026-02-20 14:48:44.177+00	2026-02-19 22:20:56.181+00
34	collection-cash-registers	{"limit": 10}	2026-02-20 15:25:10.243+00	2026-02-20 14:45:51.399+00
35	collection-investments	{}	2026-02-20 15:25:17.098+00	2026-02-20 15:25:17.097+00
36	collection-investments	{}	2026-02-20 15:25:17.273+00	2026-02-20 15:25:17.273+00
38	collection-media	{}	2026-02-20 15:25:52.884+00	2026-02-20 15:25:52.883+00
37	collection-other-categories	{"editViewType": "default"}	2026-02-20 19:26:52.011+00	2026-02-20 15:25:48.105+00
33	collection-users	{"limit": 10}	2026-02-21 08:11:27.245+00	2026-02-20 14:44:45.117+00
24	collection-users	{"limit": 10}	2026-02-21 15:11:03.841+00	2026-02-19 21:08:38.619+00
39	nav	{"groups": {"Finanse": {"open": true}}}	2026-02-21 15:14:56.234+00	2026-02-21 15:14:36.815+00
40	collection-investments	{"limit": 10, "columns": [{"active": true, "accessor": "name"}, {"active": true, "accessor": "status"}, {"active": true, "accessor": "totalCosts"}, {"active": false, "accessor": "id"}, {"active": true, "accessor": "address"}, {"active": true, "accessor": "phone"}, {"active": false, "accessor": "email"}, {"active": false, "accessor": "contactPerson"}, {"active": false, "accessor": "notes"}, {"active": true, "accessor": "totalIncome"}, {"active": true, "accessor": "laborCosts"}, {"active": false, "accessor": "updatedAt"}, {"active": false, "accessor": "createdAt"}]}	2026-02-21 15:16:20.265+00	2026-02-21 15:14:50.8+00
21	collection-cash-registers	{"limit": 10, "editViewType": "default"}	2026-02-21 16:02:12.266+00	2026-02-19 20:51:41.62+00
41	collection-transactions	{"limit": 10}	2026-02-22 13:09:54.635+00	2026-02-22 12:50:05.344+00
\.


--
-- Data for Name: payload_preferences_rels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payload_preferences_rels (id, "order", parent_id, path, users_id) FROM stdin;
34	\N	17	user	16
36	\N	18	user	15
39	\N	19	user	15
40	\N	20	user	15
41	\N	16	user	16
44	\N	15	user	15
45	\N	22	user	18
46	\N	23	user	18
54	\N	26	user	17
56	\N	27	user	17
57	\N	28	user	17
60	\N	29	user	17
61	\N	31	user	17
62	\N	32	user	17
63	\N	30	user	17
66	\N	25	user	17
68	\N	34	user	19
69	\N	35	user	19
70	\N	36	user	19
72	\N	38	user	19
73	\N	37	user	19
74	\N	33	user	19
75	\N	33	user	19
76	\N	24	user	18
81	\N	39	user	18
87	\N	40	user	18
89	\N	21	user	16
91	\N	41	user	15
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, description, amount, date, type, payment_method, source_register_id, investment_id, worker_id, other_category_id, other_description, invoice_id, invoice_note, created_by_id, updated_at, created_at, target_register_id, cancelled, cancelled_transaction_id) FROM stdin;
392	zasilenie konta 	10000	2026-02-21 00:00:00+00	COMPANY_FUNDING	CASH	5	\N	\N	\N	\N	\N	\N	16	2026-02-21 15:34:47.493+00	2026-02-21 15:34:47.493+00	\N	f	\N
394	zaliczka na materiały 	2000	2026-02-21 00:00:00+00	ACCOUNT_FUNDING	CASH	5	\N	21	\N	\N	\N	\N	16	2026-02-21 15:38:21.064+00	2026-02-21 15:38:21.064+00	\N	f	\N
395	telmak 	100	2026-02-21 00:00:00+00	EMPLOYEE_EXPENSE	CASH	\N	15	21	\N	\N	\N	\N	16	2026-02-21 15:42:38.715+00	2026-02-21 15:42:38.715+00	\N	f	\N
397	Castorama 	100	2026-02-21 00:00:00+00	EMPLOYEE_EXPENSE	CASH	\N	15	21	\N	\N	\N	\N	16	2026-02-21 15:42:38.717+00	2026-02-21 15:42:38.717+00	\N	f	\N
396	elo 	50	2026-02-21 00:00:00+00	EMPLOYEE_EXPENSE	CASH	\N	15	21	\N	\N	\N	\N	16	2026-02-21 15:42:38.72+00	2026-02-21 15:42:38.72+00	\N	f	\N
398	elo2 	150	2026-02-21 00:00:00+00	EMPLOYEE_EXPENSE	CASH	\N	15	21	\N	\N	\N	\N	16	2026-02-21 15:42:38.739+00	2026-02-21 15:42:38.739+00	\N	f	\N
399	leroy	100	2026-02-21 00:00:00+00	EMPLOYEE_EXPENSE	CASH	\N	15	21	\N	\N	\N	\N	16	2026-02-21 15:42:38.722+00	2026-02-21 15:42:38.722+00	\N	f	\N
401	asdfasdf	200	2026-02-21 00:00:00+00	INVESTMENT_EXPENSE	CASH	5	22	\N	\N	\N	\N	\N	16	2026-02-21 16:00:02.242+00	2026-02-21 16:00:02.241+00	\N	f	\N
403	zakup	200	2026-02-21 00:00:00+00	INVESTMENT_EXPENSE	CASH	5	22	\N	\N	\N	\N	\N	16	2026-02-21 16:01:36.12+00	2026-02-21 16:01:36.12+00	\N	f	\N
409		1000	2026-02-22 00:00:00+00	INVESTOR_DEPOSIT	CASH	5	19	\N	\N	\N	\N	\N	16	2026-02-22 15:49:19.099+00	2026-02-22 15:49:19.098+00	\N	f	\N
410		500	2026-02-22 00:00:00+00	COMPANY_FUNDING	CASH	6	\N	\N	\N	\N	\N	\N	16	2026-02-22 15:50:08.196+00	2026-02-22 15:50:08.195+00	\N	f	\N
411		1000	2026-02-22 00:00:00+00	OTHER_DEPOSIT	CASH	6	\N	\N	\N	\N	\N	\N	16	2026-02-22 15:50:34.017+00	2026-02-22 15:50:34.016+00	\N	f	\N
412	pozycja	1000	2026-02-22 00:00:00+00	ACCOUNT_FUNDING	CASH	5	\N	20	\N	\N	\N	\N	16	2026-02-22 16:03:05.613+00	2026-02-22 16:03:05.611+00	\N	f	\N
413	opis	500	2026-02-22 00:00:00+00	EMPLOYEE_EXPENSE	CASH	\N	\N	20	6	Młotek	\N	\N	16	2026-02-22 16:07:58.869+00	2026-02-22 16:07:58.868+00	\N	f	\N
414		100	2026-02-22 00:00:00+00	REGISTER_TRANSFER	CASH	5	\N	\N	\N	\N	\N	\N	16	2026-02-22 16:58:09.279+00	2026-02-22 16:58:09.277+00	9	f	\N
415		1000	2026-02-22 00:00:00+00	REGISTER_TRANSFER	CASH	5	\N	\N	\N	\N	\N	\N	16	2026-02-22 17:01:39.689+00	2026-02-22 17:01:39.687+00	9	f	\N
416		500	2026-02-22 00:00:00+00	REGISTER_TRANSFER	CASH	5	\N	\N	\N	\N	\N	\N	16	2026-02-22 17:20:23.235+00	2026-02-22 17:20:23.234+00	7	f	\N
417		1000	2026-02-22 00:00:00+00	REGISTER_TRANSFER	CASH	5	\N	\N	\N	\N	\N	\N	16	2026-02-22 17:24:23.751+00	2026-02-22 17:24:23.749+00	7	f	\N
418		500	2026-02-22 00:00:00+00	REGISTER_TRANSFER	CASH	5	\N	\N	\N	\N	\N	\N	16	2026-02-22 17:24:40.889+00	2026-02-22 17:24:40.889+00	7	f	\N
419		200	2026-02-22 00:00:00+00	REGISTER_TRANSFER	CASH	5	\N	\N	\N	\N	\N	\N	16	2026-02-22 17:29:11.51+00	2026-02-22 17:29:11.509+00	8	f	\N
420		500	2026-02-22 00:00:00+00	REGISTER_TRANSFER	CASH	5	\N	\N	\N	\N	\N	\N	16	2026-02-22 18:39:32.897+00	2026-02-22 18:39:32.896+00	7	f	\N
421	asdf	200	2026-02-23 00:00:00+00	INVESTMENT_EXPENSE	CASH	9	12	\N	\N	\N	\N	\N	17	2026-02-23 07:14:22.421+00	2026-02-23 07:14:22.419+00	\N	f	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, updated_at, created_at, email, reset_password_token, reset_password_expiration, salt, hash, login_attempts, lock_until, role, active, default_cash_register_id) FROM stdin;
20	test123	2026-02-21 16:35:05.133+00	2026-02-20 14:48:24.036+00	test@test.pl	\N	\N	e22bc1a79e6008ba46271aa85a6ddd46ee2e720436ca60e1b7e61bcfe56288ab	94f7973831968a4a1b19e38a59723d8ef48834e5a06cefbc92c04b1fa59a7a8b3a6fe3e236217e30db776d827fe1b6198ff13e4bbfa1e14f7d9746139a4534ff121fe793e84c4a5df4fa36fffc5728ee290e8985113c88eb4e97ede4ab3cc251bd2d50c5795b568c0a8a77bdc201b1c8b114d275cf69ad1972fa2ddee55f3b4e8f1aa9a8418a7ef2b74e0e9313517b8ae5bca7cdcabd84156b7a62bbb579d90c39e9068f3ccf217217e6509ff5f2ce81f2fec656ad6f6ca60db58dcae8f2e65c1d32ed0d728146fd733258aba2c4a0a4e8fa53564dce4e9f33d3e60583b46507921f163fc5bbc34d30564cfc7ee6a32d94258e7bc51621b0d95386ee658c8af3d97e2f8d34c2ac4927376521e685f9b17905f48e63b4b509f4a4639a2268e252d1dbf176c3c6b23e70089d4e8f75471bfbf8edd1db658c74913b347d76ac18c5a9c051ef46ca213abd9d4b43cbb0e524d8a0abc11d0c4dc22ce9da11044268813b48f967dfeaf85627d6beec5f826506cb395d2c2e6f283725c6f04f214816fd7390404f2282b1ed7f3cd09dc4baa76ed1af0592f15a1b1c79606dca44188bb69fe8b8a960fd2d2f7bb1afcfe37a92a5fda60911e9f3cdea2c8f4f9e018e5a4c6545946eaaeca768c212b6828db6334c979bdc2ffaf2a17558e9a11ca015ce1d5bb44e68feebf41236e639310e77c1d41a2c46387e405efe5fd729242c3ac88b	0	\N	EMPLOYEE	t	\N
19	Manager Test 	2026-02-21 16:35:17.858+00	2026-02-20 14:44:08.197+00	manager@wykonczymy.com.pl	\N	\N	ec0e7d784b9b2f545de435e804bbc9b6adabe62429551357360eeafdc006c88d	572700a16a9fa097440e1d508af9fc371b61d8ede1658675c28d01efeb931f3b69f538a21df2cfb9f7428655a449da189b471327059acf04dc22b979012dd3ecdb13abc11eb57786587a8f72078d5d2a17966f5c3a5578a4d18bbf1effd051a31be452d69ce936f387e55f7502e640b12c7994da6dae8e79229404293927117c78f0008f5745bf398eea63ed6e950ae24bb08bbe2995511f946808be25d78861459ba71e44b03b162b03fab80c4ec4806aff118232aef8125a22ea45b07b5e4c0e22305ce26800e02913fdf81342d9388a98a892b8cfab80d45389c10748ffa7043dd979eb1f61913f2d0404565e375410aaed29bb45e29751a4f531491a8b61895435c34b276f98f47ddda938be23e54eee4075d8c9761b3b6451bbc13956f1d8d2cadf344fcabfb10567e3f027b3d2f2457b592f544a716731e212925d1fea27793a7f7350c52777fdfb9c7de709dab600cfab62ae744cb6fd98c5b1e198bac35b9c10c2f89745f3fce3060c9a6408fafcb1f997616163fc8b05812a5285c5f6f27afe9af2882f236e52b927b18357c3a2f8202b4db1143c7cc38c72b6f6ceb8f3a32708446c8893b5bb91c3fad3339fc468c21ff7c3732fc02c97f44c0569af4444851a0e745dfc4279ba61b109e186605d79527cca424e17ec9205c0183119d8ed1ca6e48e05d9394661f20afee219a299445dfbe359d3cb57871f6d2e74	0	\N	MANAGER	t	\N
21	Oleksander Moksunov	2026-02-21 15:14:08.156+00	2026-02-21 15:14:08.155+00	moksunov@ukr.net	\N	\N	9deaac79d0eca40e7abf2d52a930c20911295af71c8bad9c1b04b7972b80de3e	3a55d7cd649aa4c9d0e1e99e366cd6ab12c21293340424a1d3a79367dd78dff47ff0871faddd2559e0b2f95c1e9728b507c37eed1f6e5eaad2892ddb76d0c8b7ee64c3bea67e9f50b934112fbc422edf38d84ef851be459eb49ecfd481fa6ff26d174743de6d0a79ad060a3158e0901ff5c335bb76cb3fa694373df8ca42dee74cb7f07ac248804857ae804da1ea85fb8b40e49caa17c2f39ad66b2c6574bc16a7c15a540d19033e240555606eddfd8fde70fd15ffc5e6e3e73d60ab89ae95258b1d11868799d687a68a6f6f73a1b8d1a725676bad94eb30ba273f3598513f9c5b5b62595bf5212f7bbfaa6bca222bec615093638938a88edb7f269c7ccd79534a5f0d5f020b46abebc9c9ddf1d038fc78db9f85489eac46f2f04d34ed17b404d5eac493fd010ee934ef25386852b46c2ab72499e6dbf887ad04025addf78af23b65a7c0a681bb05ab472acd4abf5cbfa77f985877af2533c31ee873c61b58e095f2e9a42873cf2d808dd4f84bd67b5f49e9a8c578ceba9cc94386f57e15679dfc83159b21853f89e1f309716d9793446d85893545ee3d28336e1141d60dee525b8ab790500ac30c8d217ff813f23cd3a5bd4f35b13481bcd8e49f7d6bc04e76f39c7137db6fa5eb6ecaff4d1b2a14892a2055a3bd8b7abd09eb928c8c69fa05ab5ba726d8322109ea123ee2ad19b7ee14c254eb345e5ff0afab62ea3f1d7f01	0	\N	EMPLOYEE	t	\N
18	Yuri Abramenko	2026-02-22 19:35:45.862+00	2026-02-19 20:50:50.723+00	yuri@wykonczymy.com.pl	\N	\N	eaac2d1f35d8ac4800fae84e7e905499a538dc3afdfd6e2189eb39136ad56aac	c3bd959bc7bbb757240a806e9c003d4c224e99f1398b007c4aed136d0b0bbce308273b3580314a52a90413b73db189b502514f3367eb16e075bec673894e1a9d125357211db4da6d91a854045f08ecb48ff19218f7dcb34be36bc0ebeda5b042686b697be981c84a69eaaecfa8c0f775687c2c0c8e47ae8e88d6e4bb9cccc60ed9538460f5fc7aedeb264f9fdbc9677e046417dddf49a15a65e4e2be623abbae718d16c8a7d93c003386c9c5bce7f5d7fc8fc07062be88dfaea3cfb2906a552730cb586b17eab13a1710742893065aa66597e512927514eab6e7070212827ca6f311c8da0656944cfec3e113548d8f6b15dd9167e39246616ea41e2a7b08c6af848e77dacdd8b1969fc390701933670f33468d068a1547c8e5cbbddfaf999901334857dcc69099de79d79518d3b2e7133edd19207c0317d60998f123c087d337ddf5071e3fd5ea88568724b6130588388f6788b03cbf6a2b2b755bc11ec0f116e5ccc691b878b4d791a265c4a0550d2574fe054e75d0915ea0e7271e9da0fd227ebc526a01e70d344293651c0ac36ac7d561caea5acb6bce3a618a48582c2e565cf622a449aea0efab20523fb00bf867c5eb1c331ff0ef22f933ec07998ea2a2ca28721d6fbabc0b0b10a50bd91526c0770287584787a3842cd17727c247c6f36efc66c814ae3bbcc60fa52df9376725ce81a2ea4ce22b398ea6bab19dca2672	0	\N	MANAGER	t	10
15	Konrad Antonik	2026-02-22 12:39:55.631+00	2026-02-19 19:29:37.624+00	admin@wykonczymy.com.pl	\N	\N	9a2fc48021d4e803af405988b1a955c71d867e5ab9a81c67d5cbf0b2c4f7f830	0287fce862c4b46a47d6c572627defcbb2e7ac93c42da8fb4cd216238ea61b172b7737352e6812ff059dd873ab76b7a54a0810edeb90ce1d401ac6d9c69b56d89d5f79840680a9def33f704637cdd487f1c69495c91ee606e043084001a1e7881711c1ba11cd5f2252a552a36d43f4ea436e27aebbbd2b3c23d7faa84fa202b69098ed8c1bb2375a778887d254591bd990dca0a711df802dcd4ea3ffea190f315217b608cf543f4da3a4050b17a71d4278bd1b1f26523305b81182267f9fb3fbf961499e5db8f72e8d1b77ba0258f4e9a3fdd38971e79858d812f409ef5b8bfd39ead5d70fb884a8cfb63adbdcc4ed1ed57c7275e4aef1f735f0b3232debd95dc588dc230f974b47ff1fd7cee24278342df6ace24c4f4f1ee99d58ca464be20c8282685a5d302bac8ed71aa82d1da784d27e7170772e0d1d6924daf3c88c453bbb344b0d3cb1374a2b2ae1fe96c4fee9d29a7c559c4541e380bf1c709f2687e3634235767ee62ee712a1ed300919e0740b9223eca4fe120e59aed3847a8d2ba319ebebb31a9aee6cb04846e07bd5eb6f512ddec1b4d3c42c8a42da46c3311bf7a44f61d46119484da7d37160bfc57cfe7fa9891c8da50d3e990ed21f8b82c758b7cdf0e7fbd5edd33183380470482a861e054a17af9408b23fab7d84f741dbf95f2a0ee6c5a932b5d7d9fdd90c7ef8bba7c0a26bb8935fdc9060b332d5a73ae4	0	\N	ADMIN	t	\N
16	Bartek Antonik	2026-02-22 12:40:40.218+00	2026-02-19 19:30:25.676+00	bartek@wykonczymy.com.pl	\N	\N	e8d3c94bffb650880abc19958c3ab94bb3d0ee11a786fd69b3ecec4da6c31893	74a47d1e59dd647fa23338a6954077c1ce0c68f10e19a4d5204188558842a861420b0689c7a4ee58ffad6c5f8726ff7b1458aa6c65b9e66ed157bb40040bb8c76203718f0c6c7647cca1a19c1f719695fc80f51ae7cf4694ea86ed69db170e9ee4a6326769d0099c1c78e1a95749f6a07438e0e241f5ce421bd54f1b8dbf723a66d85e801eb54c4f6135b48f07df9e78ee7d93545f42cd29781ba47789ddb736ff3edc2765545b1d99171514dcd40430c16b10292cbc37e76b1ac26d2574e77309d2750c9911b1ac67fe21ebbfc4c98d334dc22702717a72d55a11f865d8c1d07652cdad82aa50a4c0875409990f2a79a18c88269e4817295a99293b6bea480799c4908c8623823640e738fe7190d98fba723b191f3b7300e8caaccd3e95b047c9ac99508adcb9b3d19a6c60d56c3653fad494304fb2ec53893fcf60b20f470fb4ef1d2dd31db07e6ee1611245332a65e5c8891779bf0c243eb613391c0b1d6ed544beae78cfc554fde2628885fa468ace1b1de0aa5867c9e02c68c433c3a0fe2405faecff95fbfb16c0b10004185e605d0dd8bda5b65a9e61722b95fff1e323fb96af34e70b48914be969a5070bd40a80bdac8eeb7a9fb78a799fc68b92d4b7a663e142c7085fb8426979b7c8d5447d7e749ae2b8e3d86911cf5ba22ad3a76a9a1c2349729ff1d5a51738864e427e854ff7d4a9db7113ddb98707041c8b926b	0	\N	OWNER	t	5
17	Adrian Furmańczyk	2026-02-22 12:41:26.333+00	2026-02-19 20:49:39.969+00	adrian@wykonczymy.com.pl	\N	\N	fbece407097c2ab3f81ed32256457daf4cbc513e9d556ff1dd572eb86f5f1aea	141207cef8618d0683f1fcf392ae8fd094894760b5728fe76b5c41dd1ca81e86ba51a3686babd6d872cbd4864108db3a3306af5404ae0ba8008b92cd56e2d30821341fba5b41f6bf40d81e2957e4eef119bdf9316285651ac9c9cd2e9a93d92f793ade9b26f87fb7d76225898aaa81905ae4231331d395438b68aa57b84728cef234bf9a55a03a00eac7907ce5db5215f40bd8318ac7faf8af926a960f0f743a6a9c69361871aa3e409ed3a74444973a0a4bcbbfb6c72e2eff582961c7604916b7e8038e3a15d6e66691c6d67c3d25829a2701891ba514d570702cd248a446965389fe82a17091ff2e3258dcc1623b925b0125db8513f56063b87ef2aebdccc8fa30421b26d869ebf87cb531a7b0a1c7ea83bdf4732201179010225af6086d7b9e1f09bddcc79e723ec7e4f20baafeddd3b78971e8b347d84424419a6a7ea1131dbacba34e088fa2b9160774c76378a8394df42ae265c14a97f512f17af1345f5d8a077e32a118bf4f42414b333c6c24bd08f702c73001190b36c93525f4fc5b7396fbca8ff8b44dcdb26c251fcb2f5cd80d7372c294024ecc9cb6c5bea36c267268bdd09d1b4f0a0a2ef9b07afc3667ce18e522ef42ef9d0d07d588a8776168e3bccc89a794097e65afa18bb4c76baaf1bcefe48f37694a1acac870b152f995873a511c1238be729ca3d01cae39e72549769f8fc38bfad207d7b149e38d99a5	0	\N	MANAGER	t	9
\.


--
-- Data for Name: users_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users_sessions (_order, _parent_id, id, created_at, expires_at) FROM stdin;
1	16	086cdb4c-e172-4cae-ab58-f82167d91e87	2026-02-22 13:52:46.509+00	2026-02-23 13:52:46.509+00
2	16	2ab70931-62b8-4a05-977b-868f0018aad8	2026-02-22 18:45:08.087+00	2026-02-23 18:45:08.087+00
1	18	d4e4263d-7885-4660-a6d0-8c6d6e62904b	2026-02-22 19:35:45.569+00	2026-02-23 19:35:45.569+00
1	17	a90eb859-2994-498a-a3e8-dd7b21cded7c	2026-02-23 07:13:56.01+00	2026-02-24 07:13:56.01+00
1	19	9bc2d9b6-1a25-47a5-a7c6-d4587d64873f	2026-02-21 08:11:22.4+00	2026-02-22 08:11:22.4+00
\.


--
-- Name: cash_registers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cash_registers_id_seq', 11, true);


--
-- Name: investments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.investments_id_seq', 22, true);


--
-- Name: media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.media_id_seq', 6, true);


--
-- Name: other_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.other_categories_id_seq', 8, true);


--
-- Name: payload_kv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payload_kv_id_seq', 1, false);


--
-- Name: payload_locked_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payload_locked_documents_id_seq', 21, true);


--
-- Name: payload_locked_documents_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payload_locked_documents_rels_id_seq', 42, true);


--
-- Name: payload_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payload_migrations_id_seq', 23, true);


--
-- Name: payload_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payload_preferences_id_seq', 41, true);


--
-- Name: payload_preferences_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payload_preferences_rels_id_seq', 91, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 421, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 21, true);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: jwks jwks_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.jwks
    ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization organization_slug_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_slug_key UNIQUE (slug);


--
-- Name: project_config project_config_endpoint_id_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_endpoint_id_key UNIQUE (endpoint_id);


--
-- Name: project_config project_config_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: cash_registers cash_registers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_pkey PRIMARY KEY (id);


--
-- Name: investments investments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: other_categories other_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.other_categories
    ADD CONSTRAINT other_categories_pkey PRIMARY KEY (id);


--
-- Name: payload_kv payload_kv_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_kv
    ADD CONSTRAINT payload_kv_pkey PRIMARY KEY (id);


--
-- Name: payload_locked_documents payload_locked_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents
    ADD CONSTRAINT payload_locked_documents_pkey PRIMARY KEY (id);


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_pkey PRIMARY KEY (id);


--
-- Name: payload_migrations payload_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_migrations
    ADD CONSTRAINT payload_migrations_pkey PRIMARY KEY (id);


--
-- Name: payload_preferences payload_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_preferences
    ADD CONSTRAINT payload_preferences_pkey PRIMARY KEY (id);


--
-- Name: payload_preferences_rels payload_preferences_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_preferences_rels
    ADD CONSTRAINT payload_preferences_rels_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users_sessions users_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_sessions
    ADD CONSTRAINT users_sessions_pkey PRIMARY KEY (id);


--
-- Name: account_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "account_userId_idx" ON neon_auth.account USING btree ("userId");


--
-- Name: invitation_email_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX invitation_email_idx ON neon_auth.invitation USING btree (email);


--
-- Name: invitation_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "invitation_organizationId_idx" ON neon_auth.invitation USING btree ("organizationId");


--
-- Name: member_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_organizationId_idx" ON neon_auth.member USING btree ("organizationId");


--
-- Name: member_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_userId_idx" ON neon_auth.member USING btree ("userId");


--
-- Name: organization_slug_uidx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE UNIQUE INDEX organization_slug_uidx ON neon_auth.organization USING btree (slug);


--
-- Name: session_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "session_userId_idx" ON neon_auth.session USING btree ("userId");


--
-- Name: verification_identifier_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX verification_identifier_idx ON neon_auth.verification USING btree (identifier);


--
-- Name: cash_registers_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_registers_created_at_idx ON public.cash_registers USING btree (created_at);


--
-- Name: cash_registers_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_registers_owner_idx ON public.cash_registers USING btree (owner_id);


--
-- Name: cash_registers_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_registers_updated_at_idx ON public.cash_registers USING btree (updated_at);


--
-- Name: idx_transactions_cancelled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_cancelled ON public.transactions USING btree (cancelled) WHERE (cancelled = true);


--
-- Name: idx_transactions_cancelled_tx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_cancelled_tx ON public.transactions USING btree (cancelled_transaction_id);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_date ON public.transactions USING btree (date);


--
-- Name: idx_transactions_worker_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_worker_type ON public.transactions USING btree (worker_id, type) WHERE (worker_id IS NOT NULL);


--
-- Name: investments_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX investments_created_at_idx ON public.investments USING btree (created_at);


--
-- Name: investments_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX investments_updated_at_idx ON public.investments USING btree (updated_at);


--
-- Name: media_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_created_at_idx ON public.media USING btree (created_at);


--
-- Name: media_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_created_by_idx ON public.media USING btree (created_by_id);


--
-- Name: media_filename_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_filename_idx ON public.media USING btree (filename);


--
-- Name: media_sizes_thumbnail_sizes_thumbnail_filename_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_sizes_thumbnail_sizes_thumbnail_filename_idx ON public.media USING btree (sizes_thumbnail_filename);


--
-- Name: media_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_updated_at_idx ON public.media USING btree (updated_at);


--
-- Name: other_categories_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX other_categories_created_at_idx ON public.other_categories USING btree (created_at);


--
-- Name: other_categories_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX other_categories_name_idx ON public.other_categories USING btree (name);


--
-- Name: other_categories_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX other_categories_updated_at_idx ON public.other_categories USING btree (updated_at);


--
-- Name: payload_kv_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payload_kv_key_idx ON public.payload_kv USING btree (key);


--
-- Name: payload_locked_documents_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_created_at_idx ON public.payload_locked_documents USING btree (created_at);


--
-- Name: payload_locked_documents_global_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_global_slug_idx ON public.payload_locked_documents USING btree (global_slug);


--
-- Name: payload_locked_documents_rels_cash_registers_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_rels_cash_registers_id_idx ON public.payload_locked_documents_rels USING btree (cash_registers_id);


--
-- Name: payload_locked_documents_rels_investments_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_rels_investments_id_idx ON public.payload_locked_documents_rels USING btree (investments_id);


--
-- Name: payload_locked_documents_rels_media_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_rels_media_id_idx ON public.payload_locked_documents_rels USING btree (media_id);


--
-- Name: payload_locked_documents_rels_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_rels_order_idx ON public.payload_locked_documents_rels USING btree ("order");


--
-- Name: payload_locked_documents_rels_other_categories_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_rels_other_categories_id_idx ON public.payload_locked_documents_rels USING btree (other_categories_id);


--
-- Name: payload_locked_documents_rels_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_rels_parent_idx ON public.payload_locked_documents_rels USING btree (parent_id);


--
-- Name: payload_locked_documents_rels_path_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_rels_path_idx ON public.payload_locked_documents_rels USING btree (path);


--
-- Name: payload_locked_documents_rels_transactions_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_rels_transactions_id_idx ON public.payload_locked_documents_rels USING btree (transactions_id);


--
-- Name: payload_locked_documents_rels_users_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_rels_users_id_idx ON public.payload_locked_documents_rels USING btree (users_id);


--
-- Name: payload_locked_documents_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_locked_documents_updated_at_idx ON public.payload_locked_documents USING btree (updated_at);


--
-- Name: payload_migrations_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_migrations_created_at_idx ON public.payload_migrations USING btree (created_at);


--
-- Name: payload_migrations_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_migrations_updated_at_idx ON public.payload_migrations USING btree (updated_at);


--
-- Name: payload_preferences_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_preferences_created_at_idx ON public.payload_preferences USING btree (created_at);


--
-- Name: payload_preferences_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_preferences_key_idx ON public.payload_preferences USING btree (key);


--
-- Name: payload_preferences_rels_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_preferences_rels_order_idx ON public.payload_preferences_rels USING btree ("order");


--
-- Name: payload_preferences_rels_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_preferences_rels_parent_idx ON public.payload_preferences_rels USING btree (parent_id);


--
-- Name: payload_preferences_rels_path_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_preferences_rels_path_idx ON public.payload_preferences_rels USING btree (path);


--
-- Name: payload_preferences_rels_users_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_preferences_rels_users_id_idx ON public.payload_preferences_rels USING btree (users_id);


--
-- Name: payload_preferences_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payload_preferences_updated_at_idx ON public.payload_preferences USING btree (updated_at);


--
-- Name: transactions_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_created_at_idx ON public.transactions USING btree (created_at);


--
-- Name: transactions_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_created_by_idx ON public.transactions USING btree (created_by_id);


--
-- Name: transactions_investment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_investment_idx ON public.transactions USING btree (investment_id);


--
-- Name: transactions_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_invoice_idx ON public.transactions USING btree (invoice_id);


--
-- Name: transactions_other_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_other_category_idx ON public.transactions USING btree (other_category_id);


--
-- Name: transactions_source_register_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_source_register_idx ON public.transactions USING btree (source_register_id);


--
-- Name: transactions_target_register_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_target_register_idx ON public.transactions USING btree (target_register_id);


--
-- Name: transactions_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_updated_at_idx ON public.transactions USING btree (updated_at);


--
-- Name: transactions_worker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_worker_idx ON public.transactions USING btree (worker_id);


--
-- Name: users_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_created_at_idx ON public.users USING btree (created_at);


--
-- Name: users_default_cash_register_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_default_cash_register_idx ON public.users USING btree (default_cash_register_id);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_sessions_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_sessions_order_idx ON public.users_sessions USING btree (_order);


--
-- Name: users_sessions_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_sessions_parent_id_idx ON public.users_sessions USING btree (_parent_id);


--
-- Name: users_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_updated_at_idx ON public.users USING btree (updated_at);


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviterId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: cash_registers cash_registers_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: media media_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_cash_registers_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_cash_registers_fk FOREIGN KEY (cash_registers_id) REFERENCES public.cash_registers(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_investments_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_investments_fk FOREIGN KEY (investments_id) REFERENCES public.investments(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_media_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_media_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_other_categories_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_other_categories_fk FOREIGN KEY (other_categories_id) REFERENCES public.other_categories(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_locked_documents(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_transactions_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_transactions_fk FOREIGN KEY (transactions_id) REFERENCES public.transactions(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_users_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payload_preferences_rels payload_preferences_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_preferences_rels
    ADD CONSTRAINT payload_preferences_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_preferences(id) ON DELETE CASCADE;


--
-- Name: payload_preferences_rels payload_preferences_rels_users_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payload_preferences_rels
    ADD CONSTRAINT payload_preferences_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_cancelled_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_cancelled_transaction_id_fkey FOREIGN KEY (cancelled_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_cash_register_id_cash_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_cash_register_id_cash_registers_id_fk FOREIGN KEY (source_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_investment_id_investments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_investment_id_investments_id_fk FOREIGN KEY (investment_id) REFERENCES public.investments(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_invoice_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_invoice_id_media_id_fk FOREIGN KEY (invoice_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_other_category_id_other_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_other_category_id_other_categories_id_fk FOREIGN KEY (other_category_id) REFERENCES public.other_categories(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_target_register_id_cash_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_target_register_id_cash_registers_id_fk FOREIGN KEY (target_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_worker_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_worker_id_users_id_fk FOREIGN KEY (worker_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_default_cash_register_id_cash_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_default_cash_register_id_cash_registers_id_fk FOREIGN KEY (default_cash_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;


--
-- Name: users_sessions users_sessions_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_sessions
    ADD CONSTRAINT users_sessions_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 6XpvuZPBkUxBtaNouML5foggZsVUPQXm0w7ag5RE4CwgfRcKVRSvcbTW386Lyjx

