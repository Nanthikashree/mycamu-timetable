function parseEnrollmentData(text, selectedCodes) {
    const courses = {};
    const lines = text.split('\n');
    let currentCode = null;
    let currentSlotName = null;
    let waitingForName = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Match course code
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

        // Match slot line - handles both formats:
        // Old: UG - 04, T2-G18, AI - Xavier Retin
        // New: UG - 04, T1-B9, MECH
        const slotMatch = line.match(/^UG\s*-\s*\d+,\s*(T[12]-\S+)/);
        if (slotMatch && currentCode && selectedCodes.includes(currentCode)) {
            const slotName = slotMatch[1].trim();
            // Skip PHASE-1 slots (they have weird times)
            if (!slotName.includes('PHASE')) {
                currentSlotName = slotName;
            } else {
                currentSlotName = null;
            }
        }

        // Match day timings
        const dayMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday):\s*(.+)/);
        if (dayMatch && currentCode && selectedCodes.includes(currentCode) && currentSlotName) {
            const day = dayMatch[1];
            const timePart = dayMatch[2];

            // Fix concatenated times like 14:0014:00
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