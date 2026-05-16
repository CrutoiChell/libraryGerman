# Requirements Document

## Introduction

The Online Library Catalog is a web application built with Next.js and Supabase that provides a curated catalog of books. Users can browse books, search by title or author, filter by genre, view book details, and save bookmarks. Administrators can manage the catalog through a protected admin panel. The application does not host book files directly; instead, each book includes an external link to its source. The visual design follows a "Dark Premium Library" theme using glassmorphism styling.

## Glossary

- **Catalog_System**: The complete Online Library Catalog application
- **Book**: A catalog entry containing id, title, author, description, genre, cover_url, external_link, and created_at
- **Profile**: A user record containing id (uuid), email, and role (admin or user)
- **Bookmark**: An association record linking a user_id to a book_id
- **Visitor**: An unauthenticated user browsing the catalog
- **User**: An authenticated user with role "user"
- **Admin**: An authenticated user with role "admin"
- **Auth_System**: The Supabase Auth integration for login and signup
- **Home_Page**: The root route ("/") displaying hero section, search bar, genre filters, and book grid
- **Book_Detail_Page**: The dynamic route "/book/[id]" displaying a single book's information
- **Dashboard_Page**: The route ("/dashboard") displaying a User's bookmarked books
- **Admin_Panel**: The protected route ("/admin") for catalog management
- **Search_Bar**: The input component on the Home_Page for title and author queries
- **Genre_Filter**: The set of buttons on the Home_Page for filtering books by genre
- **Book_Card**: A visual component representing a single Book in a grid layout
- **Read_Online_Button**: A button on the Book_Detail_Page that opens the book's external_link
- **Database**: The Supabase PostgreSQL backend storing books, profiles, and bookmarks tables
- **Glassmorphism**: A visual style using semi-transparent backgrounds, backdrop blur, and subtle borders

## Requirements

### Requirement 1: Database Schema

**User Story:** As a developer, I want a defined database schema in Supabase, so that the application has a consistent data layer for books, profiles, and bookmarks.

#### Acceptance Criteria

1. THE Database SHALL provide a books table with columns: id, title, author, description, genre, cover_url, external_link, and created_at
2. THE Database SHALL provide a profiles table with columns: id (uuid), email, and role
3. THE Database SHALL provide a bookmarks table with columns: id, user_id, and book_id
4. THE Database SHALL restrict the profiles.role column to the values "admin" or "user"
5. THE Database SHALL enforce that bookmarks.user_id references a valid profiles.id
6. THE Database SHALL enforce that bookmarks.book_id references a valid books.id
7. THE Database SHALL enforce uniqueness on the combination of bookmarks.user_id and bookmarks.book_id

### Requirement 2: Browse Catalog on Home Page

**User Story:** As a Visitor, I want to browse a grid of available books on the home page, so that I can discover books in the catalog.

#### Acceptance Criteria

1. WHEN a Visitor navigates to the Home_Page, THE Catalog_System SHALL display a hero section containing a Search_Bar
2. WHEN a Visitor navigates to the Home_Page, THE Catalog_System SHALL display a grid of Book_Cards representing books from the books table
3. WHEN a Visitor navigates to the Home_Page, THE Catalog_System SHALL display Genre_Filter buttons for each distinct genre present in the books table
4. THE Book_Card SHALL display the book's title, author, cover_url image, and genre
5. WHEN a Visitor clicks a Book_Card, THE Catalog_System SHALL navigate to the corresponding Book_Detail_Page
6. IF the books table contains zero records, THEN THE Catalog_System SHALL display an empty-state message on the Home_Page

### Requirement 3: Search Books by Title or Author

**User Story:** As a Visitor, I want to search for books by title or author, so that I can quickly find specific books.

#### Acceptance Criteria

1. WHEN a Visitor submits a query in the Search_Bar, THE Catalog_System SHALL display Book_Cards whose title or author contains the query as a case-insensitive substring
2. WHEN a Visitor submits an empty query in the Search_Bar, THE Catalog_System SHALL display all books from the books table
3. WHEN a search returns zero matching books, THE Catalog_System SHALL display a "no results found" message
4. WHEN a Visitor clears the Search_Bar, THE Catalog_System SHALL restore the unfiltered grid of Book_Cards

### Requirement 4: Filter Books by Genre

**User Story:** As a Visitor, I want to filter books by genre, so that I can browse books in a specific category.

#### Acceptance Criteria

1. WHEN a Visitor selects a Genre_Filter button, THE Catalog_System SHALL display only Book_Cards whose genre matches the selected genre
2. WHEN a Visitor selects an "All" Genre_Filter, THE Catalog_System SHALL display Book_Cards for all books
3. WHEN a Visitor combines a Genre_Filter selection with a Search_Bar query, THE Catalog_System SHALL display Book_Cards that match both the selected genre and the search query
4. THE Catalog_System SHALL visually indicate the currently selected Genre_Filter button

### Requirement 5: View Book Details

**User Story:** As a Visitor, I want to view detailed information about a book, so that I can decide whether to read it.

#### Acceptance Criteria

1. WHEN a Visitor navigates to "/book/[id]", THE Catalog_System SHALL display the corresponding book's title, author, description, genre, and cover_url image
2. WHEN a Visitor navigates to "/book/[id]", THE Catalog_System SHALL display a Read_Online_Button linking to the book's external_link
3. WHEN a Visitor clicks the Read_Online_Button, THE Catalog_System SHALL open the external_link in a new browser tab
4. IF the requested book id does not exist in the books table, THEN THE Catalog_System SHALL display a "book not found" message

### Requirement 6: User Authentication

**User Story:** As a Visitor, I want to sign up and log in, so that I can save bookmarks and access user features.

#### Acceptance Criteria

1. WHEN a Visitor submits valid signup credentials, THE Auth_System SHALL create a new profiles record with role "user" and authenticate the session
2. WHEN a Visitor submits valid login credentials, THE Auth_System SHALL authenticate the session
3. IF a Visitor submits invalid login credentials, THEN THE Auth_System SHALL display an authentication error message
4. IF a Visitor submits a signup email that already exists, THEN THE Auth_System SHALL display a "user already exists" error message
5. WHEN a User clicks logout, THE Auth_System SHALL terminate the session and redirect to the Home_Page
6. WHILE a User session is active, THE Catalog_System SHALL display the User's email and a logout control in the navigation
7. THE Auth_System SHALL require email and password fields with a minimum password length of 8 characters

### Requirement 7: Bookmark Management

**User Story:** As a User, I want to save books to my bookmarks, so that I can revisit them later.

#### Acceptance Criteria

1. WHILE a User session is active on the Book_Detail_Page, THE Catalog_System SHALL display a bookmark toggle control
2. WHEN a User activates the bookmark toggle for an unbookmarked book, THE Catalog_System SHALL create a bookmarks record linking the User's id to the book's id
3. WHEN a User activates the bookmark toggle for a bookmarked book, THE Catalog_System SHALL delete the corresponding bookmarks record
4. THE bookmark toggle SHALL visually indicate whether the current book is bookmarked by the active User
5. IF a Visitor without a session attempts to bookmark a book, THEN THE Catalog_System SHALL redirect to the login page

### Requirement 8: User Dashboard

**User Story:** As a User, I want to see a list of my bookmarked books on a dashboard, so that I can quickly access books I want to read.

#### Acceptance Criteria

1. WHEN a User navigates to the Dashboard_Page, THE Catalog_System SHALL display Book_Cards for each book referenced in the User's bookmarks records
2. WHEN a User has zero bookmarks, THE Catalog_System SHALL display an empty-state message on the Dashboard_Page
3. WHEN a User clicks a Book_Card on the Dashboard_Page, THE Catalog_System SHALL navigate to the corresponding Book_Detail_Page
4. WHEN a User removes a bookmark from the Dashboard_Page, THE Catalog_System SHALL delete the corresponding bookmarks record and remove the Book_Card from the dashboard view
5. IF a Visitor without a session navigates to the Dashboard_Page, THEN THE Catalog_System SHALL redirect to the login page

### Requirement 9: Admin Panel Access Control

**User Story:** As an Admin, I want a protected admin route, so that only administrators can manage the catalog.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Admin_Panel, THE Catalog_System SHALL display the catalog management interface
2. IF a User with role "user" navigates to the Admin_Panel, THEN THE Catalog_System SHALL redirect to the Home_Page
3. IF a Visitor without a session navigates to the Admin_Panel, THEN THE Catalog_System SHALL redirect to the login page
4. THE Catalog_System SHALL verify the active session's profile role on every Admin_Panel request

### Requirement 10: Admin Catalog Management

**User Story:** As an Admin, I want to add, edit, and delete books, so that I can curate the catalog.

#### Acceptance Criteria

1. WHEN an Admin submits the add-book form with title, author, description, genre, cover_url, and external_link, THE Catalog_System SHALL create a new books record with the submitted values and a generated created_at timestamp
2. WHEN an Admin submits the edit-book form for an existing book, THE Catalog_System SHALL update the corresponding books record with the submitted values
3. WHEN an Admin clicks the delete control for a book, THE Catalog_System SHALL delete the corresponding books record and all bookmarks records that reference it
4. IF an Admin submits the add-book form with a missing required field, THEN THE Catalog_System SHALL display a validation error and reject the submission
5. IF an Admin submits a cover_url or external_link that is not a valid URL, THEN THE Catalog_System SHALL display a validation error and reject the submission
6. THE Admin_Panel SHALL display the current list of books with edit and delete controls for each book

### Requirement 11: Visual Theme

**User Story:** As a Visitor, I want a dark premium library aesthetic, so that the catalog feels visually distinctive and pleasant to browse.

#### Acceptance Criteria

1. THE Catalog_System SHALL apply background color "#0f172a" to all pages
2. THE Catalog_System SHALL apply accent color "#fbbf24" to interactive elements including buttons and selected Genre_Filter buttons
3. THE Book_Card SHALL apply Glassmorphism styling using semi-transparent background, backdrop blur, and a subtle border
4. THE navigation bar SHALL apply Glassmorphism styling using semi-transparent background, backdrop blur, and a subtle border
5. THE Catalog_System SHALL implement all styling using Tailwind CSS utility classes

### Requirement 12: Animations and Transitions

**User Story:** As a Visitor, I want smooth animations on hover and page transitions, so that the experience feels polished.

#### Acceptance Criteria

1. WHEN a Visitor hovers over a Book_Card, THE Catalog_System SHALL animate a visual hover effect with a transition duration between 150ms and 300ms
2. WHEN a Visitor navigates between pages, THE Catalog_System SHALL apply a fade-in transition to the new page content with a transition duration between 150ms and 500ms
3. THE Catalog_System SHALL implement all animations using CSS transitions or Tailwind CSS utilities

### Requirement 13: Responsive Layout

**User Story:** As a mobile Visitor, I want the catalog to be fully usable on a smartphone, so that I can browse books on any device.

#### Acceptance Criteria

1. WHILE the viewport width is at most 640px, THE Catalog_System SHALL display Book_Cards in a single-column grid
2. WHILE the viewport width is between 641px and 1024px, THE Catalog_System SHALL display Book_Cards in a multi-column grid with at least 2 columns
3. WHILE the viewport width is greater than 1024px, THE Catalog_System SHALL display Book_Cards in a multi-column grid with at least 3 columns
4. WHILE the viewport width is at most 640px, THE Catalog_System SHALL collapse the navigation bar into a mobile-friendly menu
5. THE Catalog_System SHALL ensure the Search_Bar, Genre_Filter, Book_Detail_Page, Dashboard_Page, and Admin_Panel are interactive and readable at viewport widths down to 320px

### Requirement 14: Catalog Source Constraints

**User Story:** As a product owner, I want the catalog to use only external book URLs and manual entry, so that the system avoids file hosting and automated ingestion.

#### Acceptance Criteria

1. THE Catalog_System SHALL store the external_link field as a URL string and SHALL NOT host book content files
2. THE Catalog_System SHALL only create books records via the Admin_Panel add-book form
3. IF a books record is created without a non-empty external_link, THEN THE Catalog_System SHALL reject the creation with a validation error
