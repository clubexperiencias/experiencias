# Experiencias

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Comprobantes en Cloudflare R2

El endpoint [`api/upload-receipt.js`](./api/upload-receipt.js) recibe el comprobante desde el flujo de pago y lo guarda en R2 mediante la API S3. En Vercel, configurá estas variables para `Preview` y `Production`:

```text
R2_ACCOUNT_ID=<Account ID de Cloudflare>
R2_ACCESS_KEY_ID=<Access Key ID del token R2>
R2_SECRET_ACCESS_KEY=<Secret Access Key del token R2>
R2_BUCKET_NAME=experiencias-comprobantes
R2_PUBLIC_URL=https://cdn.experiencias.club
```

El token debe tener únicamente permisos `Object Read & Write` sobre el bucket elegido. `R2_PUBLIC_URL` debe ser un dominio público conectado al bucket; no uses las credenciales R2 en variables expuestas al navegador. Si R2 no está disponible, la aplicación conserva el respaldo configurado en Supabase Storage.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
