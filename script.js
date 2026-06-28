document.getElementById('quote-text').textContent = '"One student\'s problem, now every student\'s shortcut."';

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
        if (waitingForName && line !== '' && line !== '-') {
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

function parseEnrollmentData(text, selectedCodes) {
    const courses = {};
    const lines = text.split('\n');
    let currentCode = null;
    let currentSlotName = null;
    let waitingForName = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        const codeMatch = line.match(/^(\d+[A-Z]+\d+)\s*\[/);
        if (codeMatch) {
            currentCode = codeMatch[1];
            currentSlotName = null;
            if (selectedCodes.includes(currentCode) && !courses[currentCode]) {
                courses[currentCode] = { name: '', slots: [] };
            }
            waitingForName = false;
        }

        if (line === 'Course overview') {
            waitingForName = true;
            continue;
        }

        if (waitingForName && line !== '' && line !== '-') {
            if (currentCode && courses[currentCode] && !courses[currentCode].name) {
                courses[currentCode].name = line;
            }
            waitingForName = false;
        }

        const slotMatch = line.match(/^UG\s*-\s*\d+,\s*(T[12]-\S+)/);
        if (slotMatch && currentCode && selectedCodes.includes(currentCode)) {
            const slotName = slotMatch[1].trim();
            if (!slotName.includes('PHASE')) {
                currentSlotName = slotName;
            } else {
                currentSlotName = null;
            }
        }

        const dayMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday):\s*(.+)/);
        if (dayMatch && currentCode && selectedCodes.includes(currentCode) && currentSlotName) {
            const day = dayMatch[1];
            const timePart = dayMatch[2];
            const fixedTime = timePart.replace(/(\d{2}:\d{2})(\d{2}:\d{2})/g, '$1 $2');
            const timeMatches = fixedTime.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/g);

            if (timeMatches && timeMatches.length > 0) {
                const startTime = timeMatches[0].split('-')[0].trim();
                const endTime = timeMatches[timeMatches.length - 1].split('-')[1].trim();
                const startHour = parseInt(startTime.split(':')[0]);
                if (startHour >= 20) continue;

                let slot = courses[currentCode].slots.find(s => s.slotName === currentSlotName);
                if (!slot) {
                    slot = { slotName: currentSlotName, times: [] };
                    courses[currentCode].slots.push(slot);
                }
                slot.times.push({ day, start: startTime, end: endTime });
            }
        }
    }
    console.log('Parsed courses:', JSON.stringify(courses, null, 2));
    return courses;
}

function hasClash(selected, newTimes) {
    for (const existing of selected) {
        for (const t1 of existing.times) {
            for (const t2 of newTimes) {
                if (t1.day === t2.day) {
                    const s1 = parseInt(t1.start.replace(':', ''));
                    const e1 = parseInt(t1.end.replace(':', ''));
                    const s2 = parseInt(t2.start.replace(':', ''));
                    const e2 = parseInt(t2.end.replace(':', ''));
                    if (s1 < e2 && s2 < e1) return true;
                }
            }
        }
    }
    return false;
}

function filterSlots(slots, skipMorning, skipEvening, dayOff) {
    return slots.filter(slot => {
        const validTimes = slot.times.filter(t => {
            const hour = parseInt(t.start.split(':')[0]);
            if (skipMorning && hour === 8) return false;
            if (skipEvening && hour >= 15) return false;
            if (dayOff !== 'none' && t.day === dayOff) return false;
            return true;
        });
        return validTimes.length > 0;
    });
}

function generateTimetables(courses, skipMorning, skipEvening, dayOff) {
    const courseCodes = Object.keys(courses);
    const results = [];

    function backtrack(index, selected) {
        if (results.length >= 2) return;
        if (index === courseCodes.length) {
            results.push(JSON.parse(JSON.stringify(selected)));
            return;
        }
        const code = courseCodes[index];
        const course = courses[code];
        const filtered = filterSlots(course.slots, skipMorning, skipEvening, dayOff);

        for (const slot of filtered) {
            if (!hasClash(selected, slot.times)) {
                selected.push({ code, name: course.name, slotName: slot.slotName, times: slot.times });
                backtrack(index + 1, selected);
                selected.pop();
                if (results.length >= 2) return;
            }
        }
    }

    backtrack(0, []);
    return results;
}

function renderTimetable(timetable, optionNum) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeBlocks = [
        { label: '8:00 - 10:00', start: '08:00', end: '10:00' },
        { label: '10:00 - 12:00', start: '10:00', end: '12:00' },
        { label: '12:00 - 13:00', start: '12:00', end: '13:00', lunch: true },
        { label: '13:00 - 15:00', start: '13:00', end: '15:00' },
        { label: '15:00 - 17:00', start: '15:00', end: '17:00' }
    ];

    let html = `<h3>Option ${optionNum}</h3>`;
    html += `<table border="1" style="width:100%;border-collapse:collapse;text-align:center;">`;
    html += `<tr style="background:#7c3aed;color:white;"><th>Time</th>`;
    days.forEach(d => html += `<th>${d}</th>`);
    html += `</tr>`;

    timeBlocks.forEach(block => {
        if (block.lunch) {
            html += `<tr><td>${block.label}</td><td colspan="6" style="background:#f8fafc;color:#aaa;">Lunch Break</td></tr>`;
            return;
        }
        html += `<tr><td>${block.label}</td>`;
        days.forEach(day => {
            let cell = '';
            timetable.forEach(course => {
                course.times.forEach(t => {
                    if (t.day === day && t.start >= block.start && t.start < block.end) {
                        cell = `${course.name}<br><small>(${course.slotName})</small>`;
                    }
                });
            });
            html += `<td style="padding:4px;">${cell}</td>`;
        });
        html += `</tr>`;
    });

    html += `</table>`;
    return html;
}

function generateTimetable() {
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

    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');

    setTimeout(() => {
        try {
            const courses = parseEnrollmentData(text, selectedCodes);
            const timetables = generateTimetables(courses, skipMorning, skipEvening, dayOff);

            document.getElementById('loading').classList.add('hidden');
            document.getElementById('results').classList.remove('hidden');

            if (timetables.length === 0) {
                document.getElementById('results').innerHTML = '<p style="color:red;text-align:center;">No clash-free timetable found with your preferences. Try relaxing some preferences!</p>';
                return;
            }

            let html = '';
            timetables.forEach((tt, i) => {
                html += renderTimetable(tt, i + 1);
            });
            document.getElementById('results').innerHTML = html;

        } catch(e) {
            document.getElementById('loading').classList.add('hidden');
            alert('Something went wrong! Please try again.');
            console.error(e);
        }
    }, 100);
}