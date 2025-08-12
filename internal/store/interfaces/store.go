package interfaces

// Store is the main interface that combines all store capabilities
// This maintains backward compatibility with the original monolithic interface
type Store interface {
	FileStore
	DirectoryStore
	RollupStore
	DockerStore
	AnalyticsStore
	InfrastructureStore
	
	// Legacy method for facade compatibility
	GetFacade() interface{} // Returns *StoreFacade but avoiding import cycles
}