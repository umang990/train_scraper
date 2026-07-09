import React, { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { parse, format, isValid } from 'date-fns';

const CardDatePicker = ({ value, onChange, placeholder = "DD-MM-YYYY" }) => {

    // Convert DD-MM-YYYY string to Date object for the picker
    const getParsedDate = (dateString) => {
        if (!dateString) return null;
        const parsed = parse(dateString, 'dd-MM-yyyy', new Date());
        return isValid(parsed) ? parsed : null;
    };

    // Convert Date object back to DD-MM-YYYY string for the parent
    const handleDateChange = (date) => {
        if (!date) {
            onChange('');
            return;
        }
        onChange(format(date, 'dd-MM-yyyy'));
    };

    const CustomInput = forwardRef(({ value, onClick, onChange, placeholder }, ref) => (
        <div className="relative w-full">
            <span className="material-symbols-outlined text-gray-400 text-base absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                calendar_month
            </span>
            <input
                ref={ref}
                type="text"
                required
                value={value}
                onClick={onClick}
                onChange={onChange}
                className="px-4 py-2.5 pl-9 text-sm text-gray-500 bg-transparent focus:outline-none w-full cursor-pointer placeholder:text-gray-400"
                placeholder={placeholder}
                readOnly
            />
        </div>
    ));

    return (
        <div className="relative w-full">
            <DatePicker
                selected={getParsedDate(value)}
                onChange={handleDateChange}
                dateFormat="dd-MM-yyyy"
                customInput={<CustomInput placeholder={placeholder} />}
                minDate={new Date()}
                showPopperArrow={false}
                wrapperClassName="w-full"
            />
        </div>
    );
};

export default CardDatePicker;
