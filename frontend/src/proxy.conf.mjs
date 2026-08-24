const BACKEND_HOST = 'http://127.0.0.1:3000/';

export default [
    {
        context: ['/api/v1'],
        target: BACKEND_HOST,
        secure: false,
        pathRewrite: {'^/api\/v1' : ''}
    }
];