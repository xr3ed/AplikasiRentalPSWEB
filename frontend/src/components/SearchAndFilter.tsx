interface SearchAndFilterProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    searchLoading?: boolean;
    
    filterValue: string;
    onFilterChange: (value: string) => void;
    filterOptions: { value: string; label: string }[];
    filterLabel?: string;
    
    resultCount?: number;
    totalCount?: number;
    
    className?: string;
}

export const SearchAndFilter = ({
    searchTerm,
    onSearchChange,
    searchPlaceholder = "Cari...",
    searchLoading = false,
    
    filterValue,
    onFilterChange,
    filterOptions,
    filterLabel = "Filter",
    
    resultCount,
    totalCount,
    
    className = ""
}: SearchAndFilterProps) => {
    return (
        <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Box */}
                <div className="flex-1">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            {searchLoading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                            ) : (
                                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filter Dropdown */}
                <div className="md:w-48">
                    <select
                        value={filterValue}
                        onChange={(e) => onFilterChange(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                    >
                        {filterOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Results Count */}
                {(resultCount !== undefined && totalCount !== undefined) && (
                    <div className="flex items-center text-gray-400 text-sm whitespace-nowrap">
                        {searchLoading ? (
                            <span>Mencari...</span>
                        ) : (
                            <span>{resultCount} dari {totalCount} item</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchAndFilter;
