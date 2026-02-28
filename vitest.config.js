import { defineConfig } from 'vitest/config'

export default defineConfig({
    plugins: [
        {
            name: 'strip-qml-pragma',
            transform(code, id) {
                if (id.endsWith('.js') && code.startsWith('.pragma library')) {
                    return code.replace(/^\.pragma library\s*/, '')
                }
            }
        }
    ]
})
