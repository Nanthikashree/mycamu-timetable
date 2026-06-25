document.getElementById('quote-text').textContent = '"One student\'s problem, now every student\'s shortcut."';

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (tab === 'text') {
        document.getElementById('text-tab').classList.add('active');
        document.querySelector('.tab-btn:first-child').classList.add('active');
    } else {
        document.getElementById('pdf-tab').classList.add('active');
        document.querySelector('.tab-btn:last-child').classList.add('active');
    }
}

document.getElementById('pdf-input').addEventListener('change', async function () {
    const file = this.files[0];
    if (file) {
        document.getElementById('pdf-name').textContent = '⏳ Reading PDF...';
        const buffer = await file.arrayBuffer();
        const response = await fetch('http://localhost:3000/upload-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/pdf' },
            body: buffer
        });
        const data = await response.json();
        if (data.text) {
            document.getElementById('enrollment-text').value = data.text;
            document.getElementById('pdf-name').textContent = '✅ ' + file.name + ' loaded!';
            document.getElementById('text-tab').classList.add('active');
document.getElementById('pdf-tab').classList.remove('active');
document.querySelector('.tab-btn:first-child').classList.add('active');
document.querySelector('.tab-btn:last-child').classList.remove('active');
        } else {
            document.getElementById('pdf-name').textContent = '❌ Failed to read PDF!';
        }
    }
});

function loadCourses() {
    const text = document.getElementById('enrollment-text').value;
    if (!text.trim()) {
        alert('Please paste your enrollment list first!');
        return;
    }

    const courses = [];
    const lines = text.split('\n');

    let currentCode = '';
    let currentCredits = '';
    let currentName = '';
    let waitingForName = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        const codeMatch = line.match(/^(\d+[A-Z]+\d+)\s*\[(\d+)\s*Credits?\]/i);
        if (codeMatch) {
            currentCode = codeMatch[1];
            currentCredits = codeMatch[2];
            currentName = '';
            waitingForName = false;
        }

        if (line === 'Course overview') {
            waitingForName = true;
            continue;
        }

        if (waitingForName && line !== '') {
            currentName = line;
            waitingForName = false;
            if (currentCode && !courses.find(c => c.code === currentCode)) {
                courses.push({ code: currentCode, credits: currentCredits, name: currentName });
            }
        }
    }

    if (courses.length === 0) {
        alert('No courses found! Make sure you pasted the enrollment list correctly.');
        return;
    }

    const coursesList = document.getElementById('courses-list');
    coursesList.innerHTML = '';

    courses.forEach((course, i) => {
        const div = document.createElement('div');
        div.className = 'course-item';
        div.innerHTML = `
            <input type="checkbox" id="course-${i}" value="${course.code}">
            <label for="course-${i}">
                <div class="course-name">${course.name}</div>
                <div class="course-code">${course.code} • ${course.credits} Credits</div>
            </label>
        `;
        coursesList.appendChild(div);
    });

    document.getElementById('courses-section').classList.remove('hidden');
}

 async function generateTimetable() {
    const text = document.getElementById('enrollment-text').value;
    if (!text.trim()) {
        alert('Please paste your enrollment list first!');
        return;
    }

    const checkboxes = document.querySelectorAll('#courses-list input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert('Please select at least one course!');
        return;
    }

    const selectedCodes = Array.from(checkboxes).map(cb => cb.value);

    const skipMorning = document.getElementById('skip-morning').checked;
    const skipEvening = document.getElementById('skip-evening').checked;
    const dayOff = document.getElementById('day-off').value;

    // Extract only selected courses with their slots
    const courseBlocks = {};
    const lines = text.split('\n');
    let currentCode = '';
    let currentBlock = '';
    let capturing = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const codeMatch = line.match(/^(\d+[A-Z]+\d+)\s*\[/);
        if (codeMatch) {
            if (capturing && currentCode) {
                courseBlocks[currentCode] = currentBlock;
            }
            currentCode = codeMatch[1];
            capturing = selectedCodes.includes(currentCode);
            currentBlock = capturing ? line + '\n' : '';
        } else if (capturing) {
            currentBlock += line + '\n';
        }
    }
    if (capturing && currentCode) {
        courseBlocks[currentCode] = currentBlock;
    }

    let filteredText = selectedCodes
        .filter(code => courseBlocks[code])
        .map(code => courseBlocks[code])
        .join('\n');

    const preferences = `
- Skip morning classes (8:00-10:00): ${skipMorning ? 'Yes' : 'No'}
- Skip evening classes (15:00-17:00): ${skipEvening ? 'Yes' : 'No'}
- Day off: ${dayOff === 'none' ? 'No preference' : dayOff}
    `;

    const prompt = `You are a college timetable generator for MyCamu enrollment system.

Each course below has multiple slots with a slot name (like T2-G18), faculty, and timings.
Student must pick EXACTLY ONE slot per course.

Generate 2 different clash-free timetable options. Rules:
- Pick exactly one slot per course
- Zero timing clashes allowed
- Respect preferences: ${preferences}
- IGNORE any slots with timings after 18:00
- Show "Course Name (SlotCode)" in each cell e.g. "Software Engineering (T2-E12)"
- Empty cells must stay empty
- Do NOT write any notes, explanations or extra text outside the tables

Use ONLY these time blocks as rows:
- 8:00 - 10:00
- 10:00 - 12:00
- 12:00 - 13:00 (Lunch Break)
- 13:00 - 15:00
- 15:00 - 17:00

Format EXACTLY like this HTML, nothing else:

<h3>Option 1</h3>
<table border="1" style="width:100%;border-collapse:collapse;text-align:center;">
<tr style="background:#7c3aed;color:white;"><th>Time</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th></tr>
<tr><td>8:00 - 10:00</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
<tr><td>10:00 - 12:00</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
<tr><td>12:00 - 13:00</td><td colspan="6" style="background:#f8fafc;color:#aaa;">Lunch Break</td></tr>
<tr><td>13:00 - 15:00</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
<tr><td>15:00 - 17:00</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
</table>

<h3>Option 2</h3>
[same format]

Enrollment data for selected courses only:
${filteredText}`;

    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');

    try {
        const response = await fetch('http://localhost:3000/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        const result = data.result;

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('results').classList.remove('hidden');
        document.getElementById('results').innerHTML = result;

    } catch (error) {
        document.getElementById('loading').classList.add('hidden');
        alert('Something went wrong! Is the server running?');
        console.error(error);
    }
}