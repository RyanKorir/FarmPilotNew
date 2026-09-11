import React, { useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, addDoc } from '../firebase';
import { db, auth } from '../firebase';
import { GoogleGenAI } from '@google/genai';
import { format, addDays, isBefore, isAfter } from 'date-fns';

interface ReminderDispatcherProps {
  selectedFarmId: string | null;
}

export default function ReminderDispatcher({ selectedFarmId }: ReminderDispatcherProps) {
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !selectedFarmId) return;

    const checkAndDispatch = async (force = false) => {
      const lastCheckKey = `last_reminder_check_${selectedFarmId}`;
      const lastCheck = localStorage.getItem(lastCheckKey);
      const now = Date.now();
      
      if (!force && lastCheck && now - parseInt(lastCheck) < 12 * 60 * 60 * 1000) {
        return;
      }

      try {
        const settingsSnap = await getDoc(doc(db, 'settings', user.uid));
        const settings = settingsSnap.exists() ? settingsSnap.data() : { notifications: {} };
        
        if (!force && !settings?.notifications?.emailSchedules) return;

        const bufferDays = settings?.notifications?.reminderBuffer || 7;
        const targetEmail = settings?.notifications?.notificationEmail || user.email;
        const cutoffDate = format(addDays(new Date(), bufferDays), 'yyyy-MM-dd');

        const vaccQuery = query(
          collection(db, 'animal_vaccinations'),
          where('ownerId', '==', user.uid),
          where('nextDueDate', '<=', cutoffDate),
          where('nextDueDate', '>', format(new Date(), 'yyyy-MM-dd'))
        );
        const vaccSnap = await getDocs(vaccQuery);
        
        const breedingQuery = query(
          collection(db, 'animal_breeding'),
          where('ownerId', '==', user.uid),
          where('expectedCalvingDate', '<=', cutoffDate),
          where('expectedCalvingDate', '>', format(new Date(), 'yyyy-MM-dd'))
        );
        const breedingSnap = await getDocs(breedingQuery);

        const reminders = [
          ...vaccSnap.docs.map(d => ({ type: 'Vaccination', ...d.data() })),
          ...breedingSnap.docs.map(d => ({ type: 'Breeding/Calving', ...d.data() }))
        ];

        if (reminders.length > 0 || force) {
          // TODO Slice 5: Move Gemini calls server-side
          const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });
          
          const remindersText = reminders.length > 0 
            ? reminders.map((r: any) => `- ${r.type}: ${r.vaccineName || 'Calving Alert'} due on ${r.nextDueDate || r.expectedCalvingDate}`).join('\n')
            : "No immediate tasks found, but this is a manual check sequence.";

          const prompt = `
            You are FarmPilot AI, a professional agricultural assistant.
            Generate a concise, professional email notification content for a farmer.
            
            Target Farmer: ${user.displayName || 'Farmer'}
            Upcoming Tasks:
            ${remindersText}
            
            Format as JSON: 
            {
              "subject": "${force ? '[MANUAL CHECK] ' : ''}FarmPilot: Important Schedule Update",
              "body": "Markdown body of the email listing the reminders or confirming setup",
              "urgency": "Normal"
            }
          `;

          const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt
          });
          
          const contentText = result.text || '{}';
          const content = JSON.parse(contentText.replace(/```json|```/g, '').trim());

          await addDoc(collection(db, 'system_notifications'), {
            userId: user.uid,
            targetEmail,
            subject: content.subject,
            body: content.body,
            type: 'schedule_reminder',
            status: force ? 'sent_manual_trigger' : 'sent_simulated',
            remindersCount: reminders.length,
            createdAt: serverTimestamp()
          });

          console.log(`[FarmPilot] ${force ? 'Manual ' : 'Automated '}Schedule Request sent to ${targetEmail}`);
          
          if (force) {
            window.dispatchEvent(new CustomEvent('notification', { detail: { message: `Schedule request sent to ${targetEmail}`, type: 'success' } }));
          }

          localStorage.setItem(lastCheckKey, now.toString());
        } else {
          localStorage.setItem(lastCheckKey, now.toString());
        }

      } catch (error) {
        console.error("Reminder Dispatcher Error:", error);
      }
    };

    const handleManualDispatch = () => checkAndDispatch(true);
    window.addEventListener('trigger-schedule', handleManualDispatch);

    checkAndDispatch();

    return () => window.removeEventListener('trigger-schedule', handleManualDispatch);
  }, [selectedFarmId]);

  return null; 
}
