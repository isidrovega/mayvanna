
import {
    services as defaultServices,
    barbers as defaultBarbers
} from "./data.js";

const SERVICES_KEY = "barbershop_services";
const STAFF_KEY = "barbershop_barbers";
const APPOINTMENTS_KEY = "barbershop_appointments";

function readArray(key, fallback = []) {
    const raw = localStorage.getItem(key);

    if (raw === null) {
        const initial = JSON.parse(JSON.stringify(fallback));
        localStorage.setItem(key, JSON.stringify(initial));
        return initial;
    }

    try {
        const value = JSON.parse(raw);
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

export function getServices() {
    return readArray(
        SERVICES_KEY,
        defaultServices.map(service => ({
            ...service,
            status: service.status || "active"
        }))
    );
}

export function getActiveServices() {
    return getServices().filter(
        service => service.status !== "inactive"
    );
}

export function getStaff() {
    return readArray(
        STAFF_KEY,
        defaultBarbers.map(person => ({
            ...person,
            status: person.status || "active",
            serviceIds: Array.isArray(person.serviceIds)
                ? [...person.serviceIds]
                : defaultServices.map(service => service.id)
        }))
    );
}

export function getActiveStaff(serviceId = "") {
    const requiredIds = (
        Array.isArray(serviceId)
            ? serviceId
            : serviceId ? [serviceId] : []
    ).map(String);

    return getStaff().filter(person => {
        if (person.status === "inactive") return false;
        if (!requiredIds.length) return true;
        if (!Array.isArray(person.serviceIds)) return false;

        const supported = new Set(
            person.serviceIds.map(String)
        );

        return requiredIds.every(id => supported.has(id));
    });
}

function uniqueIds(values) {
    return [...new Set(
        values
            .filter(value =>
                value !== null &&
                value !== undefined &&
                String(value).trim() !== ""
            )
            .map(String)
    )];
}

export function getAppointmentStaffIds(appointment = {}) {
    if (
        Array.isArray(appointment.barberIds) &&
        appointment.barberIds.length
    ) {
        return uniqueIds(appointment.barberIds);
    }

    if (
        Array.isArray(appointment.staffIds) &&
        appointment.staffIds.length
    ) {
        return uniqueIds(appointment.staffIds);
    }

    const single =
        appointment.staffId || appointment.barberId;

    return single ? [String(single)] : [];
}

function getRequestedServiceIds({
    serviceId,
    serviceIds
}) {
    return uniqueIds(
        Array.isArray(serviceIds) && serviceIds.length
            ? serviceIds
            : serviceId ? [serviceId] : []
    );
}

function toMinutes(time) {
    if (!/^\d{2}:\d{2}$/.test(String(time))) {
        return NaN;
    }

    const [hours, minutes] = String(time)
        .split(":")
        .map(Number);

    if (
        hours < 0 || hours > 23 ||
        minutes < 0 || minutes > 59
    ) {
        return NaN;
    }

    return hours * 60 + minutes;
}

function getDayKey(dateString) {
    const parts = String(dateString)
        .split("-")
        .map(Number);

    if (
        parts.length !== 3 ||
        parts.some(value => !Number.isInteger(value))
    ) {
        return null;
    }

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ][date.getDay()];
}

function getLocalDate() {
    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");
}

function getRequestedDuration(ids, duration = null) {
    if (duration !== null && duration !== undefined) {
        const number = Number(duration);

        if (Number.isFinite(number) && number > 0) {
            return number;
        }
    }

    const services = getActiveServices();
    let total = 0;

    for (const id of ids) {
        const service = services.find(
            item => String(item.id) === id
        );

        const minutes = Number(service?.duration);

        if (
            !service ||
            !Number.isFinite(minutes) ||
            minutes <= 0
        ) {
            return NaN;
        }

        total += minutes;
    }

    return total;
}

function getBookedDuration(appointment, services) {
    const duration = Number(appointment.duration);

    if (Number.isFinite(duration) && duration > 0) {
        return duration;
    }

    const ids = getRequestedServiceIds(appointment);

    const total = ids.reduce((sum, id) => {
        const service = services.find(
            item => String(item.id) === id
        );

        return sum + (Number(service?.duration) || 0);
    }, 0);

    return total > 0 ? total : 30;
}

export function getAvailableTimes({
    date,
    serviceId,
    serviceIds,
    staffId,
    staffIds,
    barberId,
    barberIds,
    duration = null,
    excludeAppointmentId = null
}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        return [];
    }

    const day = getDayKey(date);

    if (!day || date < getLocalDate()) {
        return [];
    }

    const ids = getRequestedServiceIds({
        serviceId,
        serviceIds
    });

    const selectedStaffIds = getAppointmentStaffIds({
        staffId,
        staffIds,
        barberId,
        barberIds
    });

    if (!ids.length || !selectedStaffIds.length) {
        return [];
    }

    const activeServices = getActiveServices();

    if (!ids.every(id =>
        activeServices.some(
            service => String(service.id) === id
        )
    )) {
        return [];
    }

    const qualified = getActiveStaff(ids);

    const professionals = selectedStaffIds.map(id =>
        qualified.find(person => String(person.id) === id)
    );

    if (professionals.some(person => !person)) {
        return [];
    }

    const totalDuration = getRequestedDuration(
        ids,
        duration
    );

    if (
        !Number.isFinite(totalDuration) ||
        totalDuration <= 0
    ) {
        return [];
    }

    let opening = 0;
    let closing = 1440;

    for (const person of professionals) {
        const schedule = person.schedule?.[day];

        if (schedule?.enabled === false) {
            return [];
        }

        const start = toMinutes(
            schedule?.start || "09:00"
        );

        const end = toMinutes(
            schedule?.end || "19:00"
        );

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            start >= end
        ) {
            return [];
        }

        opening = Math.max(opening, start);
        closing = Math.min(closing, end);
    }

    if (opening >= closing) {
        return [];
    }

    const selected = new Set(selectedStaffIds);

    const appointments = readArray(
        APPOINTMENTS_KEY
    ).filter(appointment => {
        if (appointment.date !== date) return false;

        if (
            excludeAppointmentId !== null &&
            String(appointment.id) ===
            String(excludeAppointmentId)
        ) {
            return false;
        }

        if (
            ["cancelled", "no-show"].includes(
                appointment.status
            )
        ) {
            return false;
        }

        return getAppointmentStaffIds(
            appointment
        ).some(id => selected.has(id));
    });

    const allServices = getServices();
    const today = getLocalDate();
    const now = new Date();

    const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

    const result = [];

    for (
        let start = Math.ceil(opening / 30) * 30;
        start + totalDuration <= closing;
        start += 30
    ) {
        if (
            date === today &&
            start <= currentMinutes
        ) {
            continue;
        }

        const end = start + totalDuration;

        const overlaps = appointments.some(
            appointment => {
                const bookedStart = toMinutes(
                    appointment.time
                );

                if (!Number.isFinite(bookedStart)) {
                    return false;
                }

                const bookedEnd =
                    bookedStart +
                    getBookedDuration(
                        appointment,
                        allServices
                    );

                return (
                    start < bookedEnd &&
                    end > bookedStart
                );
            }
        );

        if (overlaps) continue;

        result.push(
            `${String(Math.floor(start / 60)).padStart(2, "0")}:` +
            `${String(start % 60).padStart(2, "0")}`
        );
    }

    return result;
}

export function isAppointmentAvailable(appointment) {
    return getAvailableTimes({
        date: appointment.date,
        serviceId: appointment.serviceId,
        serviceIds: appointment.serviceIds,
        staffId: appointment.staffId,
        staffIds: appointment.staffIds,
        barberId: appointment.barberId,
        barberIds: appointment.barberIds,
        duration: appointment.duration,
        excludeAppointmentId:
            appointment.id ||
            appointment.excludeAppointmentId ||
            null
    }).includes(appointment.time);
}
