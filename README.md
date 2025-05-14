# Foosballek

<img src="public\images\logo_trans.png" alt="Foosball Group Tracker Logo" width="150">

![Python](https://img.shields.io/badge/Python-3.12-green.svg)
![GCP](https://img.shields.io/badge/GCP-Powered-blue.svg)
![CI/CD](https://img.shields.io/badge/CI%2FCD-passing-success.svg)
![Firestore](https://img.shields.io/badge/Firestore-yellow?logo=firebase)
![Firebase](https://img.shields.io/badge/Firebase-orange?logo=firebase)
![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js)


## About The Project

This is a web application that allows users to track their foosball matches, create groups, and maintain statistics. Deployed at [foosballek.com](https://foosballek.com).

##  ⚠️ Disclaimer

I would like to keep this service free for everyone to use. However, as a student, I may not be able to cover all hosting and maintenance costs in the long run. I'll do my best to keep it running without charges, but this might change in the future.

## Features

- **User Authentication**: Login with Google authentication
- **Group Creation**: Create and manage your foosball groups
- **Group Management**: Invite friends using unique codes and migrate existing stats from guests to them
- **Match Tracking**: Record match results and track performance
- **Statistics**: View statistics about your performance

## Technology Stack

- **Frontend**:

  - TypeScript
  - Next.js
  - Tailwind CSS

- **Backend**:

  - Firebase (Authentication, Firestore)
  - Google Cloud Functions

- **Testing & CI/CD**:

  - Jest for frontend testing
  - Pytest for Cloud Functions testing
  - GitHub Actions for continuous integration

- **Deployment**:
  - Firebase App Hosting
  - Cloudflare

## Usage

1. **Sign in**: Use your Google account to sign in
2. **Create a Group**: Create a foosball group and invite your friends using a code
3. **Record Matches**: Enter the results of your foosball matches
4. **View Statistics**: Check your performance statistics and rankings

## Screenshots
### Dashboard:
<img width="941" alt="image" src="https://github.com/user-attachments/assets/23ac481a-c0ba-48b5-89d8-e941e0a6dce6" />

### Matches:
<img width="937" alt="image" src="https://github.com/user-attachments/assets/969a2e40-cdb6-4a8b-b16d-04f2a91077ae" />

### Statistics:
<img width="956" alt="image" src="https://github.com/user-attachments/assets/c112e996-f7cf-4097-8b39-327f8b60e1c1" />


## Deployment

The application is deployed to [foosballek.com](https://foosballek.com) using Firebase App Hosting.

## Continuous Integration

The project uses GitHub Actions for continuous integration, defined in `.github/workflows/ci.yml`. The CI pipeline includes:

1. **Linting**: Python code is linted using Ruff
2. **Backend Testing**: Python Cloud Functions are tested using pytest
3. **Frontend Testing**: TypeScript code is tested using Jest


## Contributing

Contributions are welcome!

## License

Distributed under the MIT License. See `LICENSE` for more information.
