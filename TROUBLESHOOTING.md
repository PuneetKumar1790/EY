# Troubleshooting Guide

## Common Issues and Solutions

### 1. Model Decommissioned Error

**Error:**
```json
{
  "success": false,
  "error": "Model `mixtral-8x7b-32768` has been decommissioned..."
}
```

**Solution:**
The system now uses `llama-3.1-70b-versatile` by default. If you still get this error:

1. Visit https://console.groq.com/docs/models to check available models
2. Open `src/config/groqClient.js`
3. Update line 83 to use an available model:
   ```javascript
   const MODEL = 'llama-3.3-70b-versatile'; // or another available model
   ```
4. Restart the server

**Common Groq Models:**
- `llama-3.1-70b-versatile`
- `llama-3.3-70b-versatile`
- `llama-3.1-8b-instant`
- `llama-3.2-11b-text-preview-v0.1`

---

### 2. npm Installation Errors

**Error:** `npm ERR! notarget No matching version found`

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Try installing again
npm install
```

---

### 3. API Key Rotation Not Working

**Issue:** API key rotation not happening

**Check:**
1. Verify you have 2 API keys in `.env`:
   ```
   GROQ_API_KEY_1=your_first_key
   GROQ_API_KEY_2=your_second_key
   ```

2. Check server logs for rotation messages:
   ```
   🔄 Rotating to API key 2/2 (Request #51)
   ```

3. If using only one key, rotation won't happen (expected behavior)

---

### 4. Email Not Sending

**Error:** Email sending failed

**Solutions:**
1. **Verify Gmail App Password:**
   - Go to Google Account → Security → 2-Step Verification
   - Generate app password for "Mail"
   - Use this password in `.env` (not your Gmail password)

2. **Check .env configuration:**
   ```
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password_16_chars
   EMAIL_TO=puneetk49081@gmail.com
   ```

3. **Test email configuration:**
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.EMAIL_USER)"
   ```

---

### 5. PDF Text Extraction Failed

**Error:** No extractable text from PDF

**Cause:** PDF contains only images (scanned document)

**Solutions:**
1. Use OCR tool to convert PDF to text first
2. Ensure PDFs are text-based (not scanned images)
3. Try different PDF parsing library

---

### 6. Rate Limit Errors

**Error:** Rate limit exceeded

**Solutions:**
1. **API Key Rotation:**
   - Add second API key to `.env`
   - System will automatically rotate

2. **Reduce request frequency:**
   - Add delays between requests
   - Process tenders sequentially

3. **Check API quotas:**
   - Visit Groq console to check limits
   - Consider upgrading plan if needed

---

### 7. Server Not Starting

**Error:** Cannot start server

**Solutions:**
```bash
# Check if port is in use
netstat -ano | findstr :3000

# Kill process if needed
taskkill /PID <PID> /F

# Or change port in .env
PORT=3001
```

---

### 8. Module Not Found Errors

**Error:** `Cannot find module`

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

### 9. Environment Variables Not Loading

**Error:** Undefined environment variables

**Solution:**
1. Ensure `.env` file exists in root directory
2. Check `.env` syntax (no spaces around `=`)
3. Restart server after changing `.env`

```env
# Correct
GROQ_API_KEY_1=sk-your-key-here

# Wrong
GROQ_API_KEY_1 = sk-your-key-here (spaces)
```

---

### 10. Large File Upload Errors

**Error:** File too large

**Solution:**
1. Increase size limit in `src/controllers/tenderController.js`:
   ```javascript
   limits: { fileSize: 50 * 1024 * 1024 }, // Increase from 50MB
   ```

2. Or compress PDFs before upload

---

## Quick Debug Commands

### Check Environment Variables
```bash
node -e "require('dotenv').config(); console.log(process.env.GROQ_API_KEY_1 ? 'Keys found' : 'Keys missing')"
```

### Test Groq Connection
```bash
node -e "const Groq = require('groq-sdk'); const g = new Groq({apiKey: 'test'}); console.log('Groq loaded')"
```

### Check Server Health
```bash
curl http://localhost:3000/health
```

### View Logs
Check console output for:
- ✅ Successful operations
- ❌ Error messages
- 🔄 API key rotations
- 📄 File operations

---

## Still Having Issues?

1. **Check Logs:** Look at console output for detailed error messages
2. **Verify Configuration:** Ensure all `.env` variables are set correctly
3. **Test Components:** Try health endpoint first
4. **Update Dependencies:** `npm install` to get latest versions
5. **Check Groq Status:** Visit https://console.groq.com/docs for API status

---

## Additional Resources

- **Groq Models:** https://console.groq.com/docs/models
- **Groq API Docs:** https://console.groq.com/docs
- **Gmail App Passwords:** https://support.google.com/accounts/answer/185833
- **Node.js Debugging:** https://nodejs.org/docs/latest/api/debugger.html

