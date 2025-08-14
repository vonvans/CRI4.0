# CRI4.0

## Prerequisites

- [Docker](https://www.docker.com/) installed and available in your system's `PATH`
- [Node.js v18.20.8](https://nodejs.org/en/download/) installed
- [Docker Compose Plugin](https://docs.docker.com/compose/install/) installed

## Installation Instructions

1. **Clone the repository:**
    ```sh
    git clone https://github.com/vonvans/CRI4.0
    cd CRI4.0
    ```

2. **Install Node.js dependencies (ensure you are using Node.js v18.20.8):**
    ```sh
    npm install
    ```

3. **Build Docker containers (from the `containers` directory):**
    ```sh
    cd containers
    sudo docker compose --profile collector --profile kathara build
    ```

4. **Start the application (in the `containers` directory):**
    ```sh
    npm start
    ```

NOTA X LORENZO: per far funzionare gli attacchi serve effettuare nelle cartella del progetto "npm install adm-zip node-fetch"
