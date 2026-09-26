# Tamizhi

Tamizhi is an interactive Tamil learning and classroom platform designed to make learning Tamil more engaging for students while giving teachers practical tools to create, manage, and deliver educational content.

The platform combines structured Tamil learning, educational games, question sets, classroom activities, student progression, and teacher analytics in a single application.

Tamizhi was originally created to support Tamil-language education in a real classroom environment and has grown into a larger learning platform for both students and teachers.

## What is Tamizhi?

Traditional language-learning activities can become repetitive, especially for younger students. Tamizhi approaches Tamil education through a combination of structured lessons, practice activities, games, classroom interaction, and progress tracking.

Students can practice Tamil independently through built-in learning content or participate in activities created by their teachers.

Teachers can create question sets, reuse built-in Tamil content, launch learning activities, manage classroom experiences, and review student performance.

The goal is to make Tamil practice something students actively want to participate in rather than simply another worksheet or assignment.

## Main Features

### Student Experience

Students have access to a dedicated learning experience that includes:

- Tamil Learning Boards
- Built-in Tamil topics
- Independent practice
- GameRoom
- Educational games
- Teacher-created activities
- Immediate answer feedback
- Explanations for incorrect answers
- XP and progression
- Achievements and streaks
- Recommended learning activities
- Classroom activities
- Live Classroom sessions

Students do not need to wait for a teacher assignment to practice. Built-in learning content can be explored independently.

### GameRoom

GameRoom transforms Tamil practice into interactive learning activities.

Students select a Tamil topic or teacher-created question set and use that content inside different game modes.

The objective is not simply to display a quiz with animations. The games are designed so that answering questions affects actual gameplay.

Game modes include experiences such as:

- Tower Defense
- Racing
- Boss Battle
- Word Ninja
- Matching
- Memory

Tamil questions provide resources, abilities, boosts, or other gameplay advantages depending on the selected game.

For example, in Tower Defense, answering questions can provide resources that students use to place or upgrade defenses.

In Racing, successful answers can contribute toward boosts and other racing advantages.

This connects educational performance with interactive gameplay while still requiring students to make gameplay decisions.

## Learning Feedback

Tamizhi is designed to do more than tell a student whether an answer is correct.

When a student answers correctly, the application provides immediate positive feedback and can award game resources or progression rewards.

When a student answers incorrectly, Tamizhi can show:

- The student's selected answer
- The correct answer
- An explanation of the concept
- Additional reinforcement when appropriate

Incorrect questions can later return during practice so students have another opportunity to demonstrate that they understand the concept.

This allows Tamizhi to focus on learning rather than simply recording scores.

## Learning Progress

Tamizhi tracks student performance across learning activities.

Progress information can include:

- Questions attempted
- Correct answers
- Incorrect answers
- Accuracy
- Learning streaks
- Topic progress
- XP
- Achievements
- Areas requiring additional practice

This information can also be used to recommend what the student should practice next.

## Teacher Experience

Teachers have a separate interface designed for creating and managing educational activities.

Teacher functionality includes:

- Question Set Library
- Built-in Tamil content
- Question Set Builder
- Custom question sets
- Editing and duplicating sets
- Answer explanations
- Student previews
- Game compatibility
- Classroom activities
- Live Classroom
- Student results
- Learning analytics

Teachers can use existing content or create their own material.

## Question Set Builder

The Question Set Builder allows teachers to create reusable educational content.

A question set can contain information such as:

- Question
- Answer choices
- Correct answer
- Explanation
- Hint
- Topic
- Difficulty
- Question type

Question sets are separated from individual games.

This means a teacher can create a Tamil question set once and potentially use that same educational content across multiple compatible games and classroom activities.

Teachers can also duplicate existing content and customize it rather than recreating everything from the beginning.

## Built-In Tamil Content

Tamizhi contains built-in educational content covering Tamil language concepts.

The platform is designed to support areas such as:

- Tamil letters
- Reading
- Vocabulary
- Grammar
- குறில் and நெடில்
- வல்லினம், மெல்லினம் and இடையினம்
- பெயர்ச்சொல்
- வினைச்சொல்
- உரிச்சொல்
- இடைச்சொல்
- திணை
- பால்
- எண்
- காலம்
- இடம்

Built-in content allows students to practice without requiring teachers to manually create every activity.

Teachers can also use built-in material as a starting point for their own question sets.

## Live Classroom

Tamizhi includes classroom functionality that allows teachers and students to participate in shared learning activities.

Teachers can launch supported activities while students join and participate from their own devices.

The platform maintains separate Teacher and Student permissions and uses authenticated accounts for classroom participation.

## Learning Analytics

Teacher analytics are intended to provide more useful information than a single final score.

Depending on the activity and available data, teachers can review information such as:

- Student accuracy
- Question performance
- Common mistakes
- Difficult questions
- Concepts that may require additional review
- Student progress

This helps teachers identify areas where students may need additional instruction.

## Reviewer Testing Instructions

Tamizhi has separate Student and Teacher experiences.

Hack Club Pixl reviewers are welcome to create their own accounts to evaluate both sides of the application.

Use the following demo class code during registration:

`8PDFMPGE`

### Testing as a Student

Create a new account and select Student as the account type.

When prompted for a class code, enter:

`8PDFMPGE`

Complete registration.

The account will initially display Pending Approval. This is part of Tamizhi's normal account onboarding process.

Once the account has been approved, sign in using the credentials you created.

A recommended Student testing flow is:

1. Sign in as a Student.
2. Open GameRoom.
3. Explore the available learning content.
4. Select a Tamil topic or question set.
5. Choose an available game.
6. Answer Tamil questions during gameplay.
7. Review correct and incorrect answer feedback.
8. Review explanations when provided.
9. Complete the activity.
10. Review results and progression.

You can also explore the Student Dashboard, Learning Boards, independent practice, progression, achievements, and other available student functionality.

### Testing as a Teacher

To evaluate the Teacher experience, create another account using a different email address.

Select Teacher as the account type.

When prompted for the class code, enter:

`8PDFMPGE`

Complete registration and wait for approval.

Once approved, sign in using the credentials you created.

A recommended Teacher testing flow is:

1. Sign in as a Teacher.
2. Open GameRoom.
3. Visit the Question Set Library.
4. Explore the available built-in Tamil content.
5. Create a new question set or duplicate an existing set.
6. Add or edit questions.
7. Configure answer choices and correct answers.
8. Add explanations where appropriate.
9. Preview the content from the Student perspective.
10. Select a compatible game and test the question set.
11. Explore Live Classroom and available learning analytics.

## Account Approval

Tamizhi uses an approval process because the application is designed for use by actual students and teachers.

New accounts therefore enter Pending Approval after registration.

For Hack Club Pixl evaluation, use:

Demo Class Code: `8PDFMPGE`

After your account is approved, sign in again using the credentials you created.

## Privacy and Security

Tamizhi uses role-based access for students and teachers.

Reviewer accounts should use the provided demo class environment.

The application is designed so that authentication, classroom access, student activity, and teacher functionality are controlled according to the user's role and permissions.

Game results and persistent progression are validated through the application's backend rather than relying entirely on browser-provided values.

## Technology

Tamizhi is a full-stack web application.

The project uses technologies including:

- Next.js
- React
- TypeScript
- Supabase
- PostgreSQL
- Row Level Security
- Modern responsive web interfaces
- Server-side APIs
- Real-time functionality

The application is designed to work across desktop, tablet, and mobile screen sizes.

## Project Architecture

Tamizhi separates several major areas of the platform:

Learning Content  
Stores Tamil topics, question sets, answers, explanations, and related educational information.

Learning Engine  
Handles questions, grading, feedback, progression, mastery, and recommendations.

GameRoom  
Uses learning content inside interactive educational games.

Teacher Tools  
Provide content creation, classroom management, Live Classroom, and analytics.

Student Experience  
Provides independent learning, games, progress tracking, and classroom participation.

This separation allows educational content to be reused across multiple experiences instead of tying each question set to a single game.

## AI Usage

AI-assisted development tools were used during the development of Tamizhi.

Tools such as Claude Code and ChatGPT were used to assist with areas including:

- Brainstorming
- Architecture discussions
- Debugging
- Code generation
- Refactoring
- Testing strategies
- Documentation
- UI and gameplay planning

AI-generated output was integrated into a larger existing application and reviewed, modified, tested, and iterated as part of the development process.

The project was not created from a single generated prompt. Development involved repeated implementation, testing, debugging, architectural changes, security work, and product iteration.

## Development Process

Tamizhi has been developed iteratively.

Major areas of development have included:

- Authentication and role-based access
- Student and Teacher interfaces
- Tamil learning content
- Question-set authoring
- GameRoom architecture
- Educational game systems
- Learning feedback
- Student progression
- Learning analytics
- Live Classroom
- Database design
- Security and Row Level Security
- Performance optimization
- Responsive design
- Testing and production stabilization

The repository commit history documents the project's development over time.

## Running the Project

Clone the repository:

git clone <repository-url>

Enter the project directory:

cd <project-directory>

Install dependencies:

npm install

Configure the required environment variables using the project's environment configuration.

Start the development server:

npm run dev

Then open the local development URL displayed by Next.js.

The application requires its configured backend services for authentication, database functionality, and other server-side features.

## Testing

The project uses TypeScript and application-level verification to help validate the implementation.

Common development checks include:

npm run lint

npx tsc --noEmit

npm run build

GameRoom also contains additional verification scripts for its V2 systems.

## Project Motivation

Tamil is one of the world's oldest living languages, but younger students learning it outside Tamil-speaking regions may have limited opportunities to use the language regularly.

Tamizhi was created to make that learning process more interactive.

Instead of relying only on worksheets, textbooks, and memorization, the platform combines structured language education with technology, games, classroom participation, and measurable progress.

The larger goal is simple:

Make students want to practice Tamil.

## Status

Tamizhi is actively being developed and improved.

The application is being tested in a real educational context, and features continue to evolve based on classroom needs, student experience, teacher workflow, testing, and feedback.

Some functionality may continue to change as the platform develops.

## Hack Club Pixl

This project is being submitted to Hack Club Pixl as a software project.

Reviewers can use the live application and the demo class code provided above to evaluate both the Student and Teacher experiences.

Demo Class Code:

`8PDFMPGE`

## Images: 

<img width="1919" height="884" alt="image" src="https://github.com/user-attachments/assets/96d7a20b-2896-485e-9328-b54892420780" />
<img width="1918" height="899" alt="image" src="https://github.com/user-attachments/assets/c53b59ae-95da-4c27-85c8-5e7d4bca0b13" />
<img width="1909" height="887" alt="image" src="https://github.com/user-attachments/assets/1051551e-d520-4b22-9541-35f6168799e2" />
<img width="1919" height="902" alt="image" src="https://github.com/user-attachments/assets/b2971526-7276-46f4-bddf-b1e59dd78cd4" />
<img width="1919" height="905" alt="image" src="https://github.com/user-attachments/assets/fa31fdc9-f6a0-474a-8c21-ea8cc4e10da1" />
<img width="1919" height="884" alt="image" src="https://github.com/user-attachments/assets/da098c77-7d42-4b6f-9350-cd308383fe10" />
<img width="1919" height="887" alt="image" src="https://github.com/user-attachments/assets/053d3407-8f5c-493b-b5c3-1231ff868af0" />
<img width="1919" height="890" alt="image" src="https://github.com/user-attachments/assets/df7bc3d2-0aa1-4f9e-a939-c861c38e642e" />
<img width="1919" height="888" alt="image" src="https://github.com/user-attachments/assets/57ee0c37-a1af-46a9-8250-3bcaa10c16e7" />
<img width="1919" height="889" alt="image" src="https://github.com/user-attachments/assets/bb32da66-396c-48db-8f1c-fd7695ddc6ec" />
<img width="1919" height="890" alt="image" src="https://github.com/user-attachments/assets/666a4bea-2e00-4fac-af1e-a2952555c472" />
<img width="1915" height="948" alt="image" src="https://github.com/user-attachments/assets/d2cc8a2f-04bd-4dae-b935-382921a1f5eb" />
<img width="1919" height="894" alt="image" src="https://github.com/user-attachments/assets/93bff431-9e2f-4fb8-b502-94d46e092fac" />
<img width="1907" height="866" alt="image" src="https://github.com/user-attachments/assets/c3b44b80-19a9-4aa2-9157-05c9f0dc2b42" />
<img width="1919" height="878" alt="image" src="https://github.com/user-attachments/assets/94368a33-6a6f-4bf6-8d30-694efa35c73d" />
<img width="1919" height="879" alt="image" src="https://github.com/user-attachments/assets/0d5f660e-0440-4349-9975-a0c51ec920d5" />
<img width="1919" height="896" alt="image" src="https://github.com/user-attachments/assets/224edfa5-858d-43fc-a78a-d86c039a689f" />
<img width="1919" height="875" alt="image" src="https://github.com/user-attachments/assets/cad8bb56-23f7-445c-88b9-31055a841a38" />
<img width="1910" height="888" alt="image" src="https://github.com/user-attachments/assets/f08fb836-2897-4a0f-8927-14bac0dbc80f" />
<img width="1919" height="895" alt="image" src="https://github.com/user-attachments/assets/08d47fda-dc91-4624-9a93-17ef9973458e" />
<img width="1919" height="893" alt="image" src="https://github.com/user-attachments/assets/beb2ed7d-1639-4e85-9f93-40932daa59ed" />
<img width="1919" height="888" alt="image" src="https://github.com/user-attachments/assets/679b4105-368b-4126-9dbe-b559aa5fd22d" />
<img width="1918" height="888" alt="image" src="https://github.com/user-attachments/assets/3ebcf8a2-5357-41c2-ba61-dab3e7be3feb" />
<img width="1919" height="879" alt="image" src="https://github.com/user-attachments/assets/8d34a5a3-6f35-4445-bbf6-bd498ab9d9b7" />
<img width="1919" height="880" alt="image" src="https://github.com/user-attachments/assets/4998499c-e1f5-45e7-a1fc-e93bf4839d99" />
<img width="1919" height="891" alt="image" src="https://github.com/user-attachments/assets/5aea48a6-0430-4dd5-84b0-fac7c7bfd79c" />






















